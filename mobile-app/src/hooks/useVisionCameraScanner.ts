import { useRef } from 'react';
import {
  useCameraDevice,
  useCameraPermission,
  useObjectOutput,
  isScannedCode,
  ScannedObjectType,
} from 'react-native-vision-camera';

type Facing = 'back' | 'front';

interface UseScannerOptions {
  facing?: Facing;
  onCodeScanned: (data: string) => void;
  isActive: boolean;
  types?: ScannedObjectType[];
}

export function useVisionCameraScanner({
  facing = 'back',
  onCodeScanned,
  isActive,
  types = ['qr', 'code-128', 'ean-13', 'ean-8', 'code-39'],
}: UseScannerOptions) {
  const { hasPermission, requestPermission } = useCameraPermission();
  const device = useCameraDevice(facing);

  const onCodeScannedRef = useRef(onCodeScanned);
  onCodeScannedRef.current = onCodeScanned;

  const objectOutput = useObjectOutput({
    types,
    onObjectsScanned: (objects) => {
      if (!isActive) return;
      for (const obj of objects) {
        if (isScannedCode(obj) && obj.value) {
          onCodeScannedRef.current(obj.value);
          break;
        }
      }
    },
  });

  return {
    hasPermission,
    requestPermission,
    device,
    objectOutput,
  };
}
