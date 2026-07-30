import Phaser from 'phaser';

/**
 * 가상 도서관 씬.
 * manifest.json(방 레이아웃)을 읽어 바닥·벽·가구를 배치하고,
 * 내 픽셀 캐릭터가 걸어다니게 한다 (이동 + 충돌 + 카메라 추적).
 *
 * 캐릭터 스프라이트시트: 32x64 프레임, 한 행 56프레임.
 * 행 1 = idle, 행 2 = walk. 각 행에서 방향별 6프레임(오른쪽/위/왼쪽/아래 순, 추정 → 스크린샷으로 보정).
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

export interface SceneInitData {
  manifest: RoomManifest;
  assetBase?: string;
  onAction?: (action: string, name: string) => void;
}

const CHAR_COLS = 56;      // 시트 한 행의 프레임 수 (1792/32)
const PER_DIR = 6;         // 방향당 프레임 수
const IDLE_ROW = 1;
const WALK_ROW = 2;
// 방향 순서(행 안에서): 오른쪽·위·왼쪽·아래
const DIR_ORDER = { right: 0, up: 1, left: 2, down: 3 } as const;
type Dir = keyof typeof DIR_ORDER;

const SPEED = 130;

export class LibraryScene extends Phaser.Scene {
  private manifest!: RoomManifest;
  private assetBase = '/assets/library';
  private onAction?: (action: string, name: string) => void;
  private player!: Phaser.Physics.Arcade.Sprite;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: Record<string, Phaser.Input.Keyboard.Key>;
  private facing: Dir = 'down';
  private moveTarget: Phaser.Math.Vector2 | null = null;

  constructor() {
    super('LibraryScene');
  }

  init(data: SceneInitData) {
    this.manifest = data.manifest;
    if (data.assetBase) this.assetBase = data.assetBase;
    this.onAction = data.onAction;
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
    this.load.spritesheet('char', `${b}/character/premade_01.png`, {
      frameWidth: 32,
      frameHeight: 64,
    });
  }

  create() {
    const T = this.manifest.tile;
    const W = this.manifest.cols * T;
    const H = this.manifest.rows * T;

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

    // ---- 캐릭터 애니메이션 ----
    const mkFrames = (row: number, dir: Dir, count = PER_DIR) => {
      const base = row * CHAR_COLS + DIR_ORDER[dir] * PER_DIR;
      return this.anims.generateFrameNumbers('char', { start: base, end: base + count - 1 });
    };
    (['down', 'up', 'left', 'right'] as Dir[]).forEach((dir) => {
      this.anims.create({ key: `walk_${dir}`, frames: mkFrames(WALK_ROW, dir), frameRate: 8, repeat: -1 });
      const idleBase = IDLE_ROW * CHAR_COLS + DIR_ORDER[dir] * PER_DIR;
      this.anims.create({ key: `idle_${dir}`, frames: [{ key: 'char', frame: idleBase }], frameRate: 1 });
    });

    // ---- 플레이어 ----
    const startX = 11 * T;
    const startY = 11 * T;
    this.player = this.physics.add.sprite(startX, startY, 'char');
    this.player.setDepth(startY);
    this.player.play('idle_down');
    // 물리 바디 = 발 부분(작게)
    this.player.body!.setSize(18, 14);
    this.player.body!.setOffset(7, 46);
    this.physics.add.collider(this.player, solids);

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
      if (currentlyOver.some((o) => o.getData && o.getData('action'))) return;
      const wp = this.cameras.main.getWorldPoint(p.x, p.y);
      this.moveTarget = new Phaser.Math.Vector2(wp.x, wp.y);
    });
  }

  update() {
    if (!this.player) return;
    const body = this.player.body as Phaser.Physics.Arcade.Body;
    let vx = 0;
    let vy = 0;

    const left = this.cursors.left.isDown || this.wasd.A.isDown;
    const right = this.cursors.right.isDown || this.wasd.D.isDown;
    const up = this.cursors.up.isDown || this.wasd.W.isDown;
    const down = this.cursors.down.isDown || this.wasd.S.isDown;
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

    if (vx !== 0 || vy !== 0) {
      if (Math.abs(vx) > Math.abs(vy)) this.facing = vx < 0 ? 'left' : 'right';
      else this.facing = vy < 0 ? 'up' : 'down';
      this.player.play(`walk_${this.facing}`, true);
    } else {
      this.player.play(`idle_${this.facing}`, true);
    }
    this.player.setDepth(this.player.y);
  }
}
