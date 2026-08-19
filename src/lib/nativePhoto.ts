import { isNative } from '@/lib/native';

/**
 * 사진 한 장 고르기 — 앱에서는 카메라/앨범, 웹에서는 파일 선택.
 *
 * 왜 따로 두나
 *  · 앱에서 `<input type="file">` 을 쓰면 iOS 가 파일 앱 시트를 먼저 띄운다.
 *    책을 등록하는 사람은 대개 **책이 손에 있는 상태**라, 파일을 고르는 게 아니라 찍고 싶다.
 *  · Apple 심사 4.2(Minimum Functionality) — 웹을 감싸기만 한 앱은 반려된다.
 *    카메라는 이 앱에서 억지스럽지 않은 유일한 네이티브 기능이다.
 *
 * 반환은 **Blob 하나로 통일**한다. 부르는 쪽이 웹이냐 앱이냐를 몰라도 되게.
 * 취소하면 null.
 */
export type PhotoSource = 'camera' | 'library';

/** 앱에서 카메라를 쓸 수 있는가 (웹에서는 항상 false) */
export const canUseNativeCamera = isNative;

export async function pickPhoto(source: PhotoSource): Promise<Blob | null> {
  if (!isNative) return null;   // 웹은 부르는 쪽이 <input type="file"> 을 쓴다

  const { Camera, CameraResultType, CameraSource } = await import('@capacitor/camera');

  try {
    const photo = await Camera.getPhoto({
      // uri 로 받아 fetch 한다. base64 로 받으면 큰 사진에서 문자열이 수십 MB가 되어
      // 웹뷰 메모리를 그대로 먹는다.
      resultType: CameraResultType.Uri,
      source: source === 'camera' ? CameraSource.Camera : CameraSource.Photos,
      // 표지는 목록에서 작게 쓰이고 원본은 업로드 한도(5MB)에 걸린다.
      quality: 82,
      width: 1200,
      correctOrientation: true,
      // 자르기는 끄는 게 낫다 — 책은 세로가 길어 기본 정사각 틀에 맞추면 위아래가 잘린다.
      allowEditing: false,
    });

    if (!photo.webPath) return null;
    const res = await fetch(photo.webPath);
    return await res.blob();
  } catch (err) {
    // 사용자가 취소해도 예외로 온다 — 실패와 구분해 조용히 넘긴다.
    const msg = String((err as { message?: string })?.message ?? err);
    if (/cancel|denied|User cancelled/i.test(msg)) return null;
    throw err;
  }
}
