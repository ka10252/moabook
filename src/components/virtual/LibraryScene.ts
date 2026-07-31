import Phaser from 'phaser';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { type AvatarConfig, avatarLayers, defaultAvatar, loadImage } from '@/lib/avatar';
import { supabase } from '@/integrations/supabase/client';

/**
 * 가상 도서관 씬.
 * manifest.json(방 레이아웃)을 읽어 바닥·벽·가구를 배치하고,
 * 내 픽셀 캐릭터가 걸어다니게 한다 (이동 + 충돌 + 카메라 추적).
 *
 * 캐릭터: 몸·눈·옷·헤어 4레이어를 겹쳐 그린다 (pixel_avatar).
 * 잘라낸 레이어 시트: 32x64 프레임, 24열 × 2행(0=idle, 1=walk).
 * 방향별 6프레임(오른쪽·위·왼쪽·아래 순).
 */

export interface RoomManifest {
  tile: number;
  cols: number;
  rows: number;
  floor: string;
  wall_body: string;
  wall_base: string;
  wall_rows: number;
  rug?: { img: string; x: number; y: number; maxTiles?: [number, number]; tiles?: [number, number] };
  furniture_sizes: Record<string, [number, number]>;
  furniture: { name: string; col: number; rowBottom: number; dx?: number; dy?: number; action?: string }[];
}

export interface ReadingBook {
  id?: string | null;          // 우리 books 테이블의 책이면 id (검색으로 찾은 임의의 책은 null)
  title: string;
  author?: string | null;
  coverUrl?: string | null;
  description?: string | null;
}

/** 표지 텍스처 캐싱·변경감지에 쓰는 안정 키 (우리 책이면 id, 아니면 표지 URL/제목) */
const readingKey = (b: ReadingBook) => b.id || b.coverUrl || b.title;

export interface PresenceConfig {
  channelName: string;                 // 예: space:global, space:community:{id}
  me: { userId: string; nickname: string; avatar: AvatarConfig; readingBook?: ReadingBook | null };
}

export interface RoomMember {
  userId: string;
  nickname: string;
  avatar: AvatarConfig;
}

export interface SceneInitData {
  manifest: RoomManifest;
  assetBase?: string;
  onAction?: (action: string, name: string) => void;
  onOpenProfile?: (userId: string) => void;
  onOpenReadingBook?: (book: ReadingBook) => void;
  onTourStart?: () => void;   // 사서 안내 시작(첫 방문 자동/사서 탭) → React가 중앙 팝업 표시
  avatar?: AvatarConfig;
  presence?: PresenceConfig;
  members?: RoomMember[];   // 커뮤니티룸: 멤버 전원(미접속자는 zzz로 표시)
}

interface RemotePlayer {
  sprite: Phaser.GameObjects.Sprite;
  label: Phaser.GameObjects.Text;
  readingBubble?: Phaser.GameObjects.Container;
  readingSig?: string | null;
  texKey: string;
  tx: number; ty: number;            // 목표 위치 (보간용)
  dir: Dir; moving: boolean;
}

const CHAR_COLS = 24;      // 잘라낸 아바타 시트 한 행의 프레임 수
const PER_DIR = 6;         // 방향당 프레임 수
const IDLE_ROW = 0;
const WALK_ROW = 1;
// 방향 순서(행 안에서): 오른쪽·위·왼쪽·아래
const DIR_ORDER = { right: 0, up: 1, left: 2, down: 3 } as const;
type Dir = keyof typeof DIR_ORDER;

const SPEED = 130;

export class LibraryScene extends Phaser.Scene {
  private manifest!: RoomManifest;
  private assetBase = '/assets/library';
  private onAction?: (action: string, name: string) => void;
  private onOpenProfile?: (userId: string) => void;
  private onOpenReadingBook?: (book: ReadingBook) => void;
  private avatar: AvatarConfig = defaultAvatar();
  private layerKeys: string[] = [];                      // 이 아바타의 레이어 텍스처 키 (몸→…→액세서리)
  private player!: Phaser.Physics.Arcade.Sprite;         // 몸(물리 바디) — 나머지 레이어는 여기에 붙음
  private layers: Phaser.GameObjects.Sprite[] = [];      // 눈·옷·헤어·액세서리 (몸 위에 동기화)
  private playerLabel?: Phaser.GameObjects.Text;         // 내 이름표(하단)
  private playerReading?: Phaser.GameObjects.Container;  // 내 "지금 읽는 책" 말풍선(상단, 표지)
  private coverLoads = new Map<string, Promise<string | null>>();  // 표지 텍스처 로딩 캐시
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: Record<string, Phaser.Input.Keyboard.Key>;
  private facing: Dir = 'down';
  private moveTarget: Phaser.Math.Vector2 | null = null;
  // 멀티플레이어(Presence)
  private presenceCfg?: PresenceConfig;
  private channel?: RealtimeChannel;
  private remotes = new Map<string, RemotePlayer>();
  private pendingRemotes = new Set<string>();
  private members: RoomMember[] = [];
  private offline = new Map<string, { sprite: Phaser.GameObjects.Sprite; label: Phaser.GameObjects.Text; zzz: Phaser.GameObjects.Text }>();
  private pendingOffline = new Set<string>();
  private bubbles: { bubble: Phaser.GameObjects.Container; userId: string; getPos: () => { x: number; y: number } | null; expire: number }[] = [];
  // 사서 NPC & 안내 투어 (안내 팝업은 React가 그림; Phaser는 사서 + 가구 하이라이트만)
  private furnitureRectByAction = new Map<string, { x: number; y: number; w: number; h: number }>();
  private librarianSprite?: Phaser.GameObjects.Sprite;
  private tourHi?: Phaser.GameObjects.Graphics;
  private onTourStart?: () => void;
  private lastBroadcast = 0;
  private lastSent = { x: 0, y: 0, dir: 'down' as Dir, moving: false };

  constructor() {
    super('LibraryScene');
  }

  init(data: SceneInitData) {
    this.manifest = data.manifest;
    if (data.assetBase) this.assetBase = data.assetBase;
    this.onAction = data.onAction;
    this.onOpenProfile = data.onOpenProfile;
    this.onOpenReadingBook = data.onOpenReadingBook;
    this.onTourStart = data.onTourStart;
    if (data.avatar) this.avatar = data.avatar;
    this.presenceCfg = data.presence;
    this.members = data.members ?? [];
    // 씬 재시작 시 상태 초기화
    this.remotes = new Map();
    this.pendingRemotes = new Set();
    this.offline = new Map();
    this.pendingOffline = new Set();
    this.furnitureRectByAction = new Map();
    this.librarianSprite = undefined;
    this.tourHi = undefined;
  }

  preload() {
    const b = this.assetBase;
    this.load.image('floor', `${b}/${this.manifest.floor}`);
    this.load.image('wall_body', `${b}/${this.manifest.wall_body}`);
    this.load.image('wall_base', `${b}/${this.manifest.wall_base}`);
    if (this.manifest.rug) this.load.image('rug', `${b}/${this.manifest.rug.img}`);
    Object.keys(this.manifest.furniture_sizes).forEach((name) => {
      this.load.image(`f_${name}`, `${b}/furniture/${name}.png`);
    });
    // 아바타 레이어(몸·눈·옷·헤어·액세서리)를 스프라이트시트로 로드 (24열 × 2행, 32x64)
    // 아바타가 바뀌어 씬을 재시작할 때 같은 키로 새 URL을 받으려면 기존 텍스처를 지운다.
    const layers = avatarLayers(this.avatar);
    this.layerKeys = layers.map((l) => l.key);
    // 이전 액세서리 텍스처가 남아있을 수 있으니 정리
    if (this.textures.exists('av_acc') && !this.layerKeys.includes('av_acc')) this.textures.remove('av_acc');
    layers.forEach(({ key, url }) => {
      if (this.textures.exists(key)) this.textures.remove(key);
      this.load.spritesheet(key, url, { frameWidth: 32, frameHeight: 64 });
    });
    // 사서(관리자) NPC — 유저가 만들 수 없는 전용 스킨(원본 캐릭터 팩에서 사전 합성한 정적 시트).
    // 게시판이 있는 방(커뮤니티룸)에만 등장하므로 그 경우에만 로드한다.
    if (this.manifest.furniture.some((f) => f.action === 'board') && !this.textures.exists('npc_librarian')) {
      this.load.spritesheet('npc_librarian', `${b}/character/librarian.png`, { frameWidth: 32, frameHeight: 64 });
    }
  }

  /** 단일 캐릭터 스프라이트시트(24×2 레이아웃)에 idle/walk 애니메이션 4방향을 만든다. */
  private createCharAnims(key: string) {
    (['down', 'up', 'left', 'right'] as Dir[]).forEach((dir) => {
      const walkBase = WALK_ROW * CHAR_COLS + DIR_ORDER[dir] * PER_DIR;
      const idleBase = IDLE_ROW * CHAR_COLS + DIR_ORDER[dir] * PER_DIR;
      if (!this.anims.exists(`${key}_walk_${dir}`)) {
        this.anims.create({ key: `${key}_walk_${dir}`, frames: this.anims.generateFrameNumbers(key, { start: walkBase, end: walkBase + PER_DIR - 1 }), frameRate: 8, repeat: -1 });
      }
      if (!this.anims.exists(`${key}_idle_${dir}`)) {
        this.anims.create({ key: `${key}_idle_${dir}`, frames: [{ key, frame: idleBase }], frameRate: 1 });
      }
    });
  }

  create() {
    const T = this.manifest.tile;
    const W = this.manifest.cols * T;
    const H = this.manifest.rows * T;

    // 예전에 저장된 아바타가 이제 없는 에셋(교체·삭제된 헤어/옷)을 가리킬 수 있다.
    // 로드에 실패한 레이어는 건너뛰어 씬이 깨지지 않게 한다. (몸 텍스처가 없으면 기본 몸으로 대체)
    this.layerKeys = this.layerKeys.filter((k) => this.textures.exists(k));
    if (!this.textures.exists('av_body')) {
      // 몸까지 실패한 극단적 경우 → 기본 몸을 즉시 로드해 깨짐 방지 (동기 불가하므로 최소한 필터 유지)
      this.layerKeys = this.layerKeys.filter((k) => k !== 'av_body');
    }

    // ---- 바닥 (타일 반복) ----
    this.add.tileSprite(0, 0, W, H, 'floor').setOrigin(0, 0).setDepth(-1000);

    // ---- 벽 (상단 wall_rows) ----
    const wallH = this.manifest.wall_rows;
    for (let c = 0; c < this.manifest.cols; c++) {
      this.add.image(c * T, 0, 'wall_body').setOrigin(0, 0).setDepth(-900);
      this.add.image(c * T, (wallH - 1) * T, 'wall_base').setOrigin(0, 0).setDepth(-900);
    }

    // ---- 러그 ----
    if (this.manifest.rug) {
      const r = this.manifest.rug;
      let rw: number;
      let rh: number;
      if (r.tiles) {
        // 카펫 타일을 영역만큼 반복 (커뮤니티 방)
        rw = r.tiles[0] * T;
        rh = r.tiles[1] * T;
      } else {
        // 단일 러그 이미지 (도서관)
        const tex = this.textures.get('rug').getSourceImage() as HTMLImageElement;
        rw = Math.min(tex.width, (r.maxTiles?.[0] ?? 4) * T);
        rh = Math.min(tex.height, (r.maxTiles?.[1] ?? 3) * T);
      }
      this.add.tileSprite(r.x * T, r.y * T, rw, rh, 'rug').setOrigin(0, 0).setDepth(-800);
    }

    // ---- 충돌체 그룹 (가구 발밑) ----
    const solids = this.physics.add.staticGroup();

    // ---- 가구 ----
    this.manifest.furniture.forEach((item) => {
      const [w, h] = this.manifest.furniture_sizes[item.name];
      const x = item.col * T + (item.dx ?? 0);
      const y = (item.rowBottom + 1) * T + (item.dy ?? 0);
      const img = this.add.image(x, y, `f_${item.name}`).setOrigin(0, 1);
      img.setDepth(y); // 아래에 있을수록 앞에 그려져 캐릭터와 겹침 처리

      // 상호작용 가구(예: 게시판) → 클릭 시 액션 발생, 반짝이는 힌트
      if (item.action) {
        this.furnitureRectByAction.set(item.action, { x, y: y - h, w, h }); // 투어 하이라이트용 영역
        // 모바일에서 정확히 안 눌러도 되도록 넉넉한 탭 영역(Zone)을 얹는다
        const zoneW = Math.max(w + T, T * 2);
        const zoneH = Math.max(h + T, T * 2.5);
        const zone = this.add.zone(x + w / 2, y - h / 2, zoneW, zoneH).setInteractive({ useHandCursor: true });
        zone.setData('action', item.action);
        zone.on('pointerdown', () => this.onAction?.(item.action!, item.name));
        // 눈에 띄도록 은은한 펄스
        this.tweens.add({ targets: img, alpha: 0.7, duration: 900, yoyo: true, repeat: -1 });
        // 무엇인지 알 수 있게 픽셀 폰트 라벨(게시판처럼) — 가구 위에 표시
        const FURNITURE_LABELS: Record<string, string> = { shelf: '책장', board: '게시판' };
        const labelText = FURNITURE_LABELS[item.action];
        if (labelText) {
          // 게시판: 스프라이트 상단(원래 베이크된 글자가 있던 자리)에 라벨을 얹는다.
          // 그 외(책장 등): 가구 바로 위.
          const labelY = item.action === 'board' ? y - h + 16 : y - h - 3;
          this.add.text(x + w / 2, labelY, labelText, {
            fontFamily: 'Galmuri11, monospace', fontSize: '10px', color: '#3a2d22', resolution: 3,
          }).setOrigin(0.5, 1).setDepth(y + 1);
        }
      } else {
        // 발밑 충돌 박스 (상호작용 벽면 게시판/포스터는 벽쪽이라 충돌 불필요)
        const isWallDecor = item.rowBottom < this.manifest.wall_rows;
        if (!isWallDecor) {
          const footH = Math.min(h * 0.4, 22);
          const rect = this.add.rectangle(x + w / 2, y - footH / 2, w * 0.9, footH);
          solids.add(rect);
          (rect.body as Phaser.Physics.Arcade.StaticBody).updateFromGameObject();
          rect.setVisible(false);
        }
      }
    });

    // ---- 캐릭터 애니메이션 (레이어별로 동일 프레임 정의) ----
    // 씬 재시작 시 중복 생성되지 않도록 기존 것은 지우고 다시 만든다(텍스처가 바뀌었을 수 있음).
    this.layerKeys.forEach((tex) => {
      (['down', 'up', 'left', 'right'] as Dir[]).forEach((dir) => {
        const walkKey = `${tex}_walk_${dir}`;
        const idleKey = `${tex}_idle_${dir}`;
        if (this.anims.exists(walkKey)) this.anims.remove(walkKey);
        if (this.anims.exists(idleKey)) this.anims.remove(idleKey);
        const walkBase = WALK_ROW * CHAR_COLS + DIR_ORDER[dir] * PER_DIR;
        this.anims.create({
          key: walkKey,
          frames: this.anims.generateFrameNumbers(tex, { start: walkBase, end: walkBase + PER_DIR - 1 }),
          frameRate: 8,
          repeat: -1,
        });
        const idleFrame = IDLE_ROW * CHAR_COLS + DIR_ORDER[dir] * PER_DIR;
        this.anims.create({ key: idleKey, frames: [{ key: tex, frame: idleFrame }], frameRate: 1 });
      });
    });

    // ---- 플레이어 (몸=물리 바디, 나머지 레이어는 매 프레임 위치 동기화) ----
    const startX = 11 * T;
    const startY = 11 * T;
    this.player = this.physics.add.sprite(startX, startY, 'av_body');
    this.player.setDepth(startY);
    this.player.play('av_body_idle_down');
    this.player.body!.setSize(18, 14);
    this.player.body!.setOffset(7, 46);
    this.physics.add.collider(this.player, solids);
    // 눈·옷·헤어·액세서리 레이어
    this.layers = this.layerKeys.slice(1).map((tex) => {
      const s = this.add.sprite(startX, startY, tex).setOrigin(0.5, 0.5);
      s.play(`${tex}_idle_down`);
      return s;
    });
    // 내 이름표 (하단, 픽셀 폰트) + 지금 읽는 책 말풍선(상단)
    if (this.presenceCfg?.me.nickname) {
      this.playerLabel = this.makeNameLabel(startX, startY, this.presenceCfg.me.nickname);
    }
    if (this.presenceCfg?.me.readingBook) {
      this.playerReading = this.makeReadingBubble(startX, startY, this.presenceCfg.me.readingBook);
    }

    // ---- 카메라 ----
    this.physics.world.setBounds(0, wallH * T, W, H - wallH * T);
    this.player.setCollideWorldBounds(true);
    const cam = this.cameras.main;
    const zoom = 2;
    cam.setZoom(zoom);
    cam.setBackgroundColor('#e9e2d0');
    cam.startFollow(this.player, true, 0.1, 0.1);
    // 방이 화면보다 좁으면 카메라를 방 가운데에 고정(좌측 쏠림/여백 방지),
    // 넓으면 캐릭터를 따라가며 경계까지만.
    const viewW = this.scale.width / zoom;
    const viewH = this.scale.height / zoom;
    if (W <= viewW && H <= viewH) {
      cam.stopFollow();
      cam.centerOn(W / 2, H / 2);
    } else {
      cam.setBounds(0, 0, W, H);
    }

    // ---- 입력 ----
    this.cursors = this.input.keyboard!.createCursorKeys();
    this.wasd = this.input.keyboard!.addKeys('W,A,S,D') as Record<string, Phaser.Input.Keyboard.Key>;
    // 탭한 곳으로 걷기 (상호작용 가구를 탭한 경우는 이동하지 않음)
    this.input.on('pointerdown', (p: Phaser.Input.Pointer, currentlyOver: Phaser.GameObjects.GameObject[]) => {
      // 상호작용 오브젝트(가구/캐릭터/읽는 책 말풍선/사서)를 탭한 경우는 이동하지 않는다
      if (currentlyOver.some((o) => o.getData && (o.getData('action') || o.getData('remoteUser') || o.getData('reading') || o.getData('npc')))) return;
      const wp = this.cameras.main.getWorldPoint(p.x, p.y);
      this.moveTarget = new Phaser.Math.Vector2(wp.x, wp.y);
    });

    // ---- 멀티플레이어(Presence) ----
    if (this.presenceCfg) this.setupPresence();
    this.refreshOffline(); // 커뮤니티룸: 멤버 전원 표시(미접속 zzz)
    // 커뮤니티룸(게시판 가구가 있는 방)에만 사서 NPC 배치 (실패해도 방은 정상 동작)
    try {
      if (this.manifest.furniture.some((f) => f.action === 'board')) this.spawnLibrarian();
    } catch (e) {
      console.error('librarian spawn failed (non-fatal):', e);
    }
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      if (this.channel) { supabase.removeChannel(this.channel); this.channel = undefined; }
    });
  }

  /** 아바타 config를 하나의 캔버스 텍스처로 합성하고 애니메이션을 준비한다 (원격 캐릭터용). */
  private async ensureAvatarTexture(cfg: AvatarConfig): Promise<string> {
    const key = `av:${cfg.body}_${cfg.eyes}_${cfg.hairShape}_${cfg.hairColor}_${cfg.outfitStyle}_${cfg.outfitColor}_${cfg.accessory}`;
    if (this.textures.exists(key)) return key;
    const imgs = (await Promise.all(avatarLayers(cfg).map((l) => loadImage(l.url).catch(() => null)))).filter(Boolean) as HTMLImageElement[];
    if (this.textures.exists(key)) return key; // 동시 요청 방지
    const canvas = document.createElement('canvas');
    canvas.width = CHAR_COLS * 32; canvas.height = 2 * 64;
    const ctx = canvas.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;
    for (const im of imgs) ctx.drawImage(im, 0, 0);
    const tex = this.textures.addCanvas(key, canvas)!;
    let i = 0;
    for (let r = 0; r < 2; r++) for (let c = 0; c < CHAR_COLS; c++) { tex.add(i, 0, c * 32, r * 64, 32, 64); i++; }
    (['down', 'up', 'left', 'right'] as Dir[]).forEach((dir) => {
      const walkBase = WALK_ROW * CHAR_COLS + DIR_ORDER[dir] * PER_DIR;
      const idleBase = IDLE_ROW * CHAR_COLS + DIR_ORDER[dir] * PER_DIR;
      if (!this.anims.exists(`${key}_walk_${dir}`)) {
        this.anims.create({ key: `${key}_walk_${dir}`, frames: Array.from({ length: PER_DIR }, (_, f) => ({ key, frame: walkBase + f })), frameRate: 8, repeat: -1 });
      }
      if (!this.anims.exists(`${key}_idle_${dir}`)) {
        this.anims.create({ key: `${key}_idle_${dir}`, frames: [{ key, frame: idleBase }], frameRate: 1 });
      }
    });
    return key;
  }

  /** 캐릭터 하단 이름표 (픽셀 폰트 Galmuri11) */
  private makeNameLabel(x: number, y: number, name: string, faded = false) {
    return this.add.text(x, y + 32, name, {
      fontFamily: 'Galmuri11, monospace', fontSize: '8px',
      color: faded ? '#8a8276' : '#3a2d22', resolution: 3,
    }).setOrigin(0.5, 0).setDepth(y + 1);
  }

  /**
   * 읽는 책 말풍선 (머리 위). 책 표지가 말풍선을 가득 채우고, 클릭하면 책 설명을 연다.
   * 표지가 아직 안 뜬(또는 없는) 동안엔 제목 텍스트로 대체하고, 로드되면 표지로 교체한다.
   */
  private makeReadingBubble(x: number, y: number, book: ReadingBook) {
    const c = this.add.container(x, y - 20).setDepth(y + 2);
    const openDetail = () => this.onOpenReadingBook?.(book);
    // 클릭용 "최상위 Zone" — 가구 게시판/책장 Zone처럼 최상위 오브젝트라 입력이 확실히 잡힌다.
    // (컨테이너 자체·컨테이너 자식 입력은 이 씬에서 불안정.) 매 프레임 말풍선을 따라간다(update).
    const hitZone = this.add.zone(x, y - 39, 46, 42).setOrigin(0.5)
      .setInteractive({ useHandCursor: true }).setData('reading', true).setDepth(99999);
    hitZone.on('pointerdown', openDetail);
    c.setData('hitZone', hitZone);
    c.once('destroy', () => hitZone.destroy());

    const t = book.title.length > 12 ? book.title.slice(0, 12) + '…' : book.title;
    const fallback = this.add.text(0, 0, `📖 ${t}`, {
      fontFamily: 'Galmuri11, monospace', fontSize: '10px',
      color: '#5a4a38', backgroundColor: '#fff7e6ee', padding: { x: 4, y: 2 }, resolution: 2,
    }).setOrigin(0.5, 1);
    c.add(fallback);

    if (book.coverUrl) {
      this.loadCover(readingKey(book), book.coverUrl).then((key) => {
        if (!key || !c.active) return;
        const src = this.textures.get(key).getSourceImage() as HTMLImageElement;
        const ratio = (src.width && src.height) ? src.width / src.height : 0.68;
        const H = 27;                       // 표지 높이(px) — 이전의 절반
        const w = Math.round(H * ratio);
        const p = 1;                        // 표지 둘레 흰 테두리 두께
        const bw = w + p * 2, bh = H + p * 2;
        const r = 3;                        // 말풍선 모서리 둥글기
        const tailW = 6, tailH = 5;         // 캐릭터를 향하는 아래 꼬리
        const border = 0x2c2621;
        const bottom = -tailH;              // 말풍선 하단(꼬리 시작) y
        const top = bottom - bh;            // 말풍선 상단 y
        const left = -bw / 2;

        // 만화 말풍선(둥근 사각형 + 아래 꼬리)을 Graphics로 그린다
        const g = this.add.graphics();
        g.fillStyle(0xffffff, 1);
        g.fillTriangle(-tailW / 2, bottom, tailW / 2, bottom, 0, 0);   // 꼬리(밑변은 몸통이 덮음)
        g.fillRoundedRect(left, top, bw, bh, r);                       // 몸통
        g.lineStyle(1.5, border, 1);
        g.strokeRoundedRect(left, top, bw, bh, r);                     // 몸통 테두리
        g.fillStyle(0xffffff, 1);
        g.fillRect(-tailW / 2 + 0.5, bottom - 1, tailW - 1, 2);        // 꼬리 연결부 테두리 지우기
        g.lineStyle(1.5, border, 1);
        g.beginPath();                                                 // 꼬리 양옆 선만
        g.moveTo(-tailW / 2, bottom); g.lineTo(0, 0); g.lineTo(tailW / 2, bottom);
        g.strokePath();

        // 표지를 말풍선 둥근 모양대로 잘라(누끼) 채운다 — 모서리를 벗어나지 않게 클립 텍스처 생성.
        // 고해상도(슈퍼샘플)로 만들고 논리 크기로 축소 표시 → pixelArt/줌에서도 모자이크 없이 또렷.
        const clipKey = this.roundedCover(key, w, H, r - p);
        const cover = this.add.image(0, top + bh / 2, clipKey).setOrigin(0.5).setDisplaySize(w, H);

        fallback.destroy();
        c.add([g, cover]);
        // 표지가 뜬 뒤 클릭 Zone 크기를 말풍선 몸통에 맞춘다(넉넉하게)
        const hz = c.getData('hitZone') as Phaser.GameObjects.Zone | undefined;
        hz?.setSize(bw + 6, bh + 6);
      });
    }
    return c;
  }

  /**
   * 표지 이미지를 w×h 둥근 사각형으로 잘라낸(누끼) 텍스처를 만들어 키를 돌려준다. 크기별 캐시.
   * 슈퍼샘플(SS배)로 크게 그린 뒤 LINEAR 필터를 걸어, 논리 크기로 축소·줌해도 모자이크 없이 또렷하게.
   */
  private roundedCover(srcKey: string, w: number, h: number, radius: number): string {
    const rk = `rc_${srcKey}_${w}x${h}`;
    if (this.textures.exists(rk)) return rk;
    const src = this.textures.get(srcKey).getSourceImage() as CanvasImageSource;
    const SS = 4;                              // 슈퍼샘플 배율(카메라 줌·레티나 대비)
    const cw = w * SS, ch = h * SS, rr = Math.max(0, radius) * SS;
    const canvas = document.createElement('canvas');
    canvas.width = cw; canvas.height = ch;
    const ctx = canvas.getContext('2d')!;
    ctx.beginPath();
    ctx.moveTo(rr, 0);
    ctx.arcTo(cw, 0, cw, ch, rr);
    ctx.arcTo(cw, ch, 0, ch, rr);
    ctx.arcTo(0, ch, 0, 0, rr);
    ctx.arcTo(0, 0, cw, 0, rr);
    ctx.closePath();
    ctx.clip();
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(src, 0, 0, cw, ch);
    const tex = this.textures.addCanvas(rk, canvas);
    tex?.setFilter(Phaser.Textures.FilterMode.LINEAR);   // 부드러운 축소/확대(모자이크 방지)
    return rk;
  }

  /** 원격 이미지를 Phaser 텍스처로 로드(HTMLImageElement 사용 — 로더 충돌 회피). keyBase로 캐시. */
  private loadCover(keyBase: string, url: string): Promise<string | null> {
    const key = `cover_${keyBase}`;
    if (this.textures.exists(key)) return Promise.resolve(key);
    const cached = this.coverLoads.get(key);
    if (cached) return cached;
    const promise = new Promise<string | null>((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => { if (!this.textures.exists(key)) this.textures.addImage(key, img); resolve(key); };
      img.onerror = () => resolve(null);
      img.src = url;
    });
    this.coverLoads.set(key, promise);
    return promise;
  }

  private myState() {
    return {
      userId: this.presenceCfg!.me.userId,
      nickname: this.presenceCfg!.me.nickname,
      avatar: this.presenceCfg!.me.avatar,
      readingBook: this.presenceCfg!.me.readingBook ?? null,
      x: Math.round(this.player.x), y: Math.round(this.player.y),
      dir: this.facing, moving: (this.player.body as Phaser.Physics.Arcade.Body).velocity.length() > 1,
    };
  }

  private setupPresence() {
    const { channelName, me } = this.presenceCfg!;
    this.channel = supabase.channel(channelName, { config: { presence: { key: me.userId } } });
    this.channel.on('presence', { event: 'sync' }, () => this.refreshRemotes());
    this.channel.on('broadcast', { event: 'bubble' }, ({ payload }) => {
      const p = payload as { from: string; kind: 'emote' | 'chat'; text: string };
      if (p.from !== me.userId) this.showBubble(p.from, p.text, p.kind === 'emote');
    });
    this.channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') this.channel!.track(this.myState());
    });
  }

  /** userId의 현재 캐릭터 위치 (나/원격/오프라인) */
  private charPos(userId: string): { x: number; y: number } | null {
    if (this.presenceCfg && userId === this.presenceCfg.me.userId && this.player) return { x: this.player.x, y: this.player.y };
    const r = this.remotes.get(userId); if (r) return { x: r.sprite.x, y: r.sprite.y };
    const o = this.offline.get(userId); if (o) return { x: o.sprite.x, y: o.sprite.y };
    return null;
  }

  /** 이모트/채팅 표시. 채팅은 머리 위 말풍선, 이모트는 캐릭터 주변에서 뿜어져 나오는 파티클. */
  private showBubble(userId: string, text: string, isEmote: boolean) {
    if (isEmote) { this.showEmote(userId, text); return; }
    const pos = this.charPos(userId); if (!pos) return;

    // 한 캐릭터는 말풍선 하나만 — 새 말이 나오면 그 유저의 기존 말풍선을 없앤다(겹쳐 반복돼 보이던 문제 방지)
    this.bubbles = this.bubbles.filter((b) => {
      if (b.userId === userId) { b.bubble.destroy(); return false; }
      return true;
    });

    // 불투명 흰 배경 텍스트 — 배경을 Phaser가 렌더 시 텍스트에 정확히 맞춰 그려서
    // 수동 측정 불일치로 글자가 잘려 보이던 문제를 없앤다. 아래 꼬리는 작은 삼각형으로.
    const c = this.add.container(pos.x, pos.y - 52).setDepth(100001);
    const label = this.add.text(0, -5, text, {
      fontFamily: 'Galmuri11, monospace', fontSize: '9px', color: '#2c2621',
      backgroundColor: '#ffffff', padding: { x: 7, y: 5 },
      align: 'center', resolution: 3, wordWrap: { width: 150 },
    }).setOrigin(0.5, 1);
    const g = this.add.graphics();
    g.fillStyle(0xffffff, 1);
    g.fillTriangle(-5, -5, 5, -5, 0, 1);   // 텍스트 박스 하단(y=-5)에서 캐릭터 쪽으로
    c.add([g, label]);
    this.bubbles.push({ bubble: c, userId, getPos: () => this.charPos(userId), expire: this.time.now + 4000 });
  }

  /** 이모트: 캐릭터 머리 주변에서 이모지 여러 개가 위로 흩어지며 사라지는 파티클 연출(배경 없음). */
  private showEmote(userId: string, emoji: string) {
    const pos = this.charPos(userId); if (!pos) return;
    const baseX = pos.x, baseY = pos.y - 24;
    const N = 7;
    for (let i = 0; i < N; i++) {
      const p = this.add.text(baseX, baseY, emoji, {
        fontFamily: 'Galmuri11, monospace', fontSize: '18px', resolution: 2,
      }).setOrigin(0.5).setDepth(100000).setScale(0.3);
      // 위쪽 중심 부채꼴로 퍼지며 전체적으로 떠오른다
      const angle = -Math.PI / 2 + (Math.random() - 0.5) * (Math.PI * 0.9);
      const dist = 30 + Math.random() * 34;
      this.tweens.add({
        targets: p, delay: i * 45,
        x: baseX + Math.cos(angle) * dist,
        y: baseY + Math.sin(angle) * dist - 12,
        scale: 0.9 + Math.random() * 0.5,
        angle: (Math.random() - 0.5) * 40,
        alpha: { from: 1, to: 0 },
        ease: 'Cubic.easeOut', duration: 1000 + Math.random() * 400,
        onComplete: () => p.destroy(),
      });
    }
  }

  /** React UI에서 호출: 채팅/이모트 전송 (브로드캐스트 + 내 머리 위에도 표시) */
  sendBubble(text: string, isEmote: boolean) {
    if (!this.channel || !this.presenceCfg) return;
    this.channel.send({ type: 'broadcast', event: 'bubble', payload: { from: this.presenceCfg.me.userId, kind: isEmote ? 'emote' : 'chat', text } });
    this.showBubble(this.presenceCfg.me.userId, text, isEmote);
  }

  /** presenceState를 읽어 원격 캐릭터를 추가/갱신/제거한다. */
  private refreshRemotes() {
    if (!this.channel || !this.presenceCfg) return;
    const state = this.channel.presenceState() as Record<string, Array<Record<string, unknown>>>;
    const seen = new Set<string>();
    for (const key of Object.keys(state)) {
      const meta = state[key][0] as unknown as { userId: string; nickname: string; avatar: AvatarConfig; x: number; y: number; dir: Dir; moving: boolean; readingBook?: ReadingBook | null };
      if (!meta || meta.userId === this.presenceCfg.me.userId) continue;
      seen.add(meta.userId);
      const existing = this.remotes.get(meta.userId);
      if (existing) {
        existing.tx = meta.x; existing.ty = meta.y; existing.dir = meta.dir; existing.moving = meta.moving;
        const sig = meta.readingBook ? readingKey(meta.readingBook) : null;
        if (existing.readingSig !== sig) {
          existing.readingBubble?.destroy();
          existing.readingBubble = meta.readingBook ? this.makeReadingBubble(existing.sprite.x, existing.sprite.y, meta.readingBook) : undefined;
          existing.readingSig = sig;
        }
      } else if (!this.pendingRemotes.has(meta.userId)) {
        this.pendingRemotes.add(meta.userId);
        this.ensureAvatarTexture(meta.avatar).then((texKey) => {
          this.pendingRemotes.delete(meta.userId);
          if (this.remotes.has(meta.userId)) return;
          const sprite = this.add.sprite(meta.x, meta.y, texKey).setDepth(meta.y);
          sprite.play(`${texKey}_idle_${meta.dir}`);
          // 클릭 → 프로필 보기
          sprite.setInteractive({ useHandCursor: true });
          sprite.setData('remoteUser', meta.userId);
          sprite.on('pointerdown', () => this.onOpenProfile?.(meta.userId));
          const label = this.makeNameLabel(meta.x, meta.y, meta.nickname);
          const readingBubble = meta.readingBook ? this.makeReadingBubble(meta.x, meta.y, meta.readingBook) : undefined;
          this.remotes.set(meta.userId, { sprite, label, readingBubble, readingSig: meta.readingBook ? readingKey(meta.readingBook) : null, texKey, tx: meta.x, ty: meta.y, dir: meta.dir, moving: meta.moving });
        });
      }
    }
    // 나간 사람 제거
    for (const [uid, rp] of this.remotes) {
      if (!seen.has(uid)) { rp.sprite.destroy(); rp.label.destroy(); rp.readingBubble?.destroy(); this.remotes.delete(uid); }
    }
    this.refreshOffline();
  }

  /** 오프라인 멤버를 방 바닥 영역 안 무작위 위치에 둔다. userId 해시로 매번 같은 자리(깜빡임 방지). */
  private offlinePos(userId: string): { x: number; y: number } {
    const T = this.manifest.tile;
    const { cols, rows, wall_rows: wallH } = this.manifest;
    let h1 = 2166136261, h2 = 5381;
    for (let i = 0; i < userId.length; i++) {
      h1 = ((h1 ^ userId.charCodeAt(i)) * 16777619) >>> 0;
      h2 = ((h2 * 33) + userId.charCodeAt(i)) >>> 0;
    }
    const rx = (h1 % 10000) / 10000, ry = (h2 % 10000) / 10000;
    const minX = 1.5 * T, maxX = (cols - 1.5) * T;               // 좌우 여백
    const minY = (wallH + 1) * T, maxY = (rows - 1) * T;         // 벽 아래 ~ 바닥 끝
    return { x: Math.round(minX + rx * (maxX - minX)), y: Math.round(minY + ry * (maxY - minY)) };
  }

  /** 커뮤니티룸: 접속 안 한 멤버를 zzz와 함께 그 자리에 둔다. 접속 중이거나 나면 제거. */
  private refreshOffline() {
    if (!this.members.length) return;
    const present = new Set<string>();
    if (this.presenceCfg) present.add(this.presenceCfg.me.userId);
    if (this.channel) {
      const state = this.channel.presenceState() as Record<string, Array<{ userId?: string }>>;
      for (const k of Object.keys(state)) { const uid = state[k][0]?.userId; if (uid) present.add(uid); }
    }
    // 접속했거나 나(=제거 대상)
    for (const [uid, o] of this.offline) {
      if (present.has(uid)) { o.sprite.destroy(); o.label.destroy(); o.zzz.destroy(); this.offline.delete(uid); }
    }
    // 오프라인 멤버 추가
    this.members.forEach((m) => {
      if (present.has(m.userId) || this.offline.has(m.userId) || this.pendingOffline.has(m.userId)) return;
      const { x, y } = this.offlinePos(m.userId);
      this.pendingOffline.add(m.userId);
      this.ensureAvatarTexture(m.avatar).then((texKey) => {
        this.pendingOffline.delete(m.userId);
        if (this.offline.has(m.userId)) return;
        const sprite = this.add.sprite(x, y, texKey).setDepth(y).setAlpha(0.75);
        sprite.play(`${texKey}_idle_down`);
        sprite.setInteractive({ useHandCursor: true });
        sprite.setData('remoteUser', m.userId);
        sprite.on('pointerdown', () => this.onOpenProfile?.(m.userId));
        const zzz = this.add.text(x + 11, y - 30, '💤', { fontSize: '13px' }).setOrigin(0.5, 1).setDepth(y + 2);
        const label = this.makeNameLabel(x, y, m.nickname, true);
        this.offline.set(m.userId, { sprite, label, zzz });
      });
    });
  }

  // ── 사서 NPC ─────────────────────────────────────────────
  // 안내 문구/단계 팝업은 React(VirtualSpacePage)가 화면 중앙에 그린다(상단 UI에 안 가리게).
  // Phaser는 사서 배치 + 안내 시작 콜백 + 가구 하이라이트만 담당.
  private static LIBRARIAN_TOUR_KEY = 'moa_room_tour_seen';

  private spawnLibrarian() {
    const T = this.manifest.tile;
    const board = this.manifest.furniture.find((f) => f.action === 'board');
    const chalk = this.manifest.furniture.find((f) => f.name === 'chalkboard');
    const midCol = board && chalk ? (board.col + chalk.col) / 2 + 1 : 9;
    const x = Math.round(midCol * T);
    // 벽(게시판·블랙보드) 바로 아래에 딱 붙인다
    const y = Math.round(this.manifest.wall_rows * T + T * 0.45);
    // 전용 스킨 시트가 없으면(로드 실패 등) 조용히 건너뛴다 — 방은 정상 동작.
    const texKey = 'npc_librarian';
    if (!this.textures.exists(texKey) || this.librarianSprite) return;
    this.createCharAnims(texKey);
    const s = this.add.sprite(x, y, texKey).setDepth(y);
    s.play(`${texKey}_idle_down`);
    s.setInteractive({ useHandCursor: true }).setData('npc', true);
    s.on('pointerdown', () => this.onTourStart?.());
    this.librarianSprite = s;
    this.add.text(x, y + 30, '📖 관리자', {
      fontFamily: 'Galmuri11, monospace', fontSize: '9px', color: '#3a2d22', resolution: 3,
    }).setOrigin(0.5, 0).setDepth(y + 1);
    // 첫 방문이면 자동으로 안내 시작
    if (!localStorage.getItem(LibraryScene.LIBRARIAN_TOUR_KEY)) {
      this.time.delayedCall(700, () => { if (this.librarianSprite?.active) this.onTourStart?.(); });
    }
  }

  /** React 투어가 특정 가구를 강조/해제 (책장·게시판) */
  highlightFurniture(action: string | null) {
    if (this.tourHi) { this.tweens.killTweensOf(this.tourHi); this.tourHi.destroy(); this.tourHi = undefined; }
    if (!action) return;
    const r = this.furnitureRectByAction.get(action);
    if (!r) return;
    const hi = this.add.graphics().setDepth(150000);
    hi.lineStyle(2.5, 0xF26A4B, 1);
    hi.strokeRoundedRect(r.x - 4, r.y - 4, r.w + 8, r.h + 8, 6);
    this.tourHi = hi;
    this.tweens.add({ targets: hi, alpha: 0.25, duration: 550, yoyo: true, repeat: -1 });
  }

  update() {
    if (!this.player) return;
    const body = this.player.body as Phaser.Physics.Arcade.Body;
    let vx = 0;
    let vy = 0;

    // 채팅 입력창에 포커스가 있으면 WASD로 캐릭터가 움직이지 않게 한다
    const ae = document.activeElement;
    const typing = !!ae && (ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA');
    const left = !typing && (this.cursors.left.isDown || this.wasd.A.isDown);
    const right = !typing && (this.cursors.right.isDown || this.wasd.D.isDown);
    const up = !typing && (this.cursors.up.isDown || this.wasd.W.isDown);
    const down = !typing && (this.cursors.down.isDown || this.wasd.S.isDown);
    const keyboardActive = left || right || up || down;

    if (keyboardActive) {
      this.moveTarget = null;
      if (left) vx = -SPEED;
      else if (right) vx = SPEED;
      if (up) vy = -SPEED;
      else if (down) vy = SPEED;
    } else if (this.moveTarget) {
      const d = Phaser.Math.Distance.Between(this.player.x, this.player.y, this.moveTarget.x, this.moveTarget.y);
      if (d < 4) {
        this.moveTarget = null;
      } else {
        const ang = Phaser.Math.Angle.Between(this.player.x, this.player.y, this.moveTarget.x, this.moveTarget.y);
        vx = Math.cos(ang) * SPEED;
        vy = Math.sin(ang) * SPEED;
      }
    }

    body.setVelocity(vx, vy);

    const moving = vx !== 0 || vy !== 0;
    if (moving) {
      if (Math.abs(vx) > Math.abs(vy)) this.facing = vx < 0 ? 'left' : 'right';
      else this.facing = vy < 0 ? 'up' : 'down';
    }
    const state = moving ? 'walk' : 'idle';
    this.player.play(`av_body_${state}_${this.facing}`, true);
    this.player.setDepth(this.player.y);
    this.playerLabel?.setPosition(this.player.x, this.player.y + 32).setDepth(this.player.y + 1);
    this.playerReading?.setPosition(this.player.x, this.player.y - 20).setDepth(this.player.y + 2);
    (this.playerReading?.getData('hitZone') as Phaser.GameObjects.Zone | undefined)?.setPosition(this.player.x, this.player.y - 39);
    // 눈·옷·헤어·액세서리 레이어를 몸에 맞춰 위치·깊이·애니메이션 동기화
    for (const s of this.layers) {
      s.setPosition(this.player.x, this.player.y);
      s.setDepth(this.player.y + 0.1);
      s.play(`${s.texture.key}_${state}_${this.facing}`, true);
    }

    // ---- 멀티플레이어: 내 위치 브로드캐스트(스로틀) + 원격 캐릭터 보간 ----
    if (this.channel) {
      const now = this.time.now;
      const changed = moving || this.lastSent.moving || this.facing !== this.lastSent.dir;
      if (now - this.lastBroadcast > 120 && changed) {
        this.lastBroadcast = now;
        this.lastSent = { x: this.player.x, y: this.player.y, dir: this.facing, moving };
        this.channel.track(this.myState());
      }
    }
    for (const rp of this.remotes.values()) {
      rp.sprite.x = Phaser.Math.Linear(rp.sprite.x, rp.tx, 0.25);
      rp.sprite.y = Phaser.Math.Linear(rp.sprite.y, rp.ty, 0.25);
      rp.sprite.setDepth(rp.sprite.y);
      rp.label.setPosition(rp.sprite.x, rp.sprite.y + 32).setDepth(rp.sprite.y + 1);
      rp.readingBubble?.setPosition(rp.sprite.x, rp.sprite.y - 20).setDepth(rp.sprite.y + 2);
      (rp.readingBubble?.getData('hitZone') as Phaser.GameObjects.Zone | undefined)?.setPosition(rp.sprite.x, rp.sprite.y - 39);
      const near = Math.abs(rp.sprite.x - rp.tx) < 1.5 && Math.abs(rp.sprite.y - rp.ty) < 1.5;
      const st = rp.moving && !near ? 'walk' : 'idle';
      rp.sprite.play(`${rp.texKey}_${st}_${rp.dir}`, true);
    }

    // 말풍선: 캐릭터 따라다니기 + 만료 제거
    if (this.bubbles.length) {
      const now = this.time.now;
      this.bubbles = this.bubbles.filter((b) => {
        const p = b.getPos();
        if (!p || now > b.expire) { b.bubble.destroy(); return false; }
        b.bubble.setPosition(p.x, p.y - 56).setDepth(100001);
        return true;
      });
    }
  }
}
