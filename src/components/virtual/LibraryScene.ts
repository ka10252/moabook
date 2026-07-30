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

export interface PresenceConfig {
  channelName: string;                 // 예: space:global, space:community:{id}
  me: { userId: string; nickname: string; avatar: AvatarConfig };
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
  avatar?: AvatarConfig;
  presence?: PresenceConfig;
  members?: RoomMember[];   // 커뮤니티룸: 멤버 전원(미접속자는 zzz로 표시)
}

interface RemotePlayer {
  sprite: Phaser.GameObjects.Sprite;
  label: Phaser.GameObjects.Text;
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
  private avatar: AvatarConfig = defaultAvatar();
  private layerKeys: string[] = [];                      // 이 아바타의 레이어 텍스처 키 (몸→…→액세서리)
  private player!: Phaser.Physics.Arcade.Sprite;         // 몸(물리 바디) — 나머지 레이어는 여기에 붙음
  private layers: Phaser.GameObjects.Sprite[] = [];      // 눈·옷·헤어·액세서리 (몸 위에 동기화)
  private playerLabel?: Phaser.GameObjects.Text;         // 내 이름표(하단)
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
  private bubbles: { bubble: Phaser.GameObjects.Text; getPos: () => { x: number; y: number } | null; expire: number }[] = [];
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
    if (data.avatar) this.avatar = data.avatar;
    this.presenceCfg = data.presence;
    this.members = data.members ?? [];
    // 씬 재시작 시 상태 초기화
    this.remotes = new Map();
    this.pendingRemotes = new Set();
    this.offline = new Map();
    this.pendingOffline = new Set();
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
        // 모바일에서 정확히 안 눌러도 되도록 넉넉한 탭 영역(Zone)을 얹는다
        const zoneW = Math.max(w + T, T * 2);
        const zoneH = Math.max(h + T, T * 2.5);
        const zone = this.add.zone(x + w / 2, y - h / 2, zoneW, zoneH).setInteractive({ useHandCursor: true });
        zone.setData('action', item.action);
        zone.on('pointerdown', () => this.onAction?.(item.action!, item.name));
        // 눈에 띄도록 은은한 펄스
        this.tweens.add({ targets: img, alpha: 0.7, duration: 900, yoyo: true, repeat: -1 });
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
    // 내 이름표 (하단, 픽셀 폰트)
    if (this.presenceCfg?.me.nickname) {
      this.playerLabel = this.makeNameLabel(startX, startY, this.presenceCfg.me.nickname);
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
      if (currentlyOver.some((o) => o.getData && (o.getData('action') || o.getData('remoteUser')))) return;
      const wp = this.cameras.main.getWorldPoint(p.x, p.y);
      this.moveTarget = new Phaser.Math.Vector2(wp.x, wp.y);
    });

    // ---- 멀티플레이어(Presence) ----
    if (this.presenceCfg) this.setupPresence();
    this.refreshOffline(); // 커뮤니티룸: 멤버 전원 표시(미접속 zzz)
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
      fontFamily: 'Galmuri11, monospace', fontSize: '11px',
      color: faded ? '#8a8276' : '#3a2d22',
      backgroundColor: '#ffffffcc', padding: { x: 3, y: 1 }, resolution: 2,
    }).setOrigin(0.5, 0).setDepth(y + 1);
  }

  private myState() {
    return {
      userId: this.presenceCfg!.me.userId,
      nickname: this.presenceCfg!.me.nickname,
      avatar: this.presenceCfg!.me.avatar,
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

  /** 머리 위 말풍선 (이모트/채팅). 몇 초 뒤 사라지고 캐릭터를 따라다닌다. */
  private showBubble(userId: string, text: string, isEmote: boolean) {
    const pos = this.charPos(userId); if (!pos) return;
    const bubble = this.add.text(pos.x, pos.y - 42, text, {
      fontFamily: 'Galmuri11, monospace', fontSize: isEmote ? '22px' : '11px',
      color: '#2c2621', backgroundColor: '#ffffffee', padding: { x: 6, y: 3 },
      align: 'center', resolution: 2, wordWrap: { width: 130 },
    }).setOrigin(0.5, 1).setDepth(100000);
    this.bubbles.push({ bubble, getPos: () => this.charPos(userId), expire: this.time.now + 4000 });
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
      const meta = state[key][0] as unknown as { userId: string; nickname: string; avatar: AvatarConfig; x: number; y: number; dir: Dir; moving: boolean };
      if (!meta || meta.userId === this.presenceCfg.me.userId) continue;
      seen.add(meta.userId);
      const existing = this.remotes.get(meta.userId);
      if (existing) {
        existing.tx = meta.x; existing.ty = meta.y; existing.dir = meta.dir; existing.moving = meta.moving;
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
          this.remotes.set(meta.userId, { sprite, label, texKey, tx: meta.x, ty: meta.y, dir: meta.dir, moving: meta.moving });
        });
      }
    }
    // 나간 사람 제거
    for (const [uid, rp] of this.remotes) {
      if (!seen.has(uid)) { rp.sprite.destroy(); rp.label.destroy(); this.remotes.delete(uid); }
    }
    this.refreshOffline();
  }

  // 오프라인 멤버 배치 슬롯 (타일 좌표)
  private static OFFLINE_SLOTS: [number, number][] = [
    [3, 9], [6, 10], [9, 10], [12, 9], [2, 7], [13, 7], [7, 3], [10, 3], [5, 6], [11, 6], [1, 9], [14, 9],
  ];

  /** 커뮤니티룸: 접속 안 한 멤버를 zzz와 함께 그 자리에 둔다. 접속 중이거나 나면 제거. */
  private refreshOffline() {
    if (!this.members.length) return;
    const T = this.manifest.tile;
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
    this.members.forEach((m, idx) => {
      if (present.has(m.userId) || this.offline.has(m.userId) || this.pendingOffline.has(m.userId)) return;
      const slot = LibraryScene.OFFLINE_SLOTS[idx % LibraryScene.OFFLINE_SLOTS.length];
      const x = slot[0] * T + 16, y = slot[1] * T + 32;
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
        b.bubble.setPosition(p.x, p.y - 42).setDepth(100000);
        return true;
      });
    }
  }
}
