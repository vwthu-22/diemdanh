'use client';
import { useRef, useState, useEffect, useCallback } from 'react';
import { euclideanDistance } from '@/lib/faceApi';
import styles from './faceverify.module.css';

const THRESHOLD = 0.52; // khoảng cách tối đa để xem là cùng người

interface Props {
  studentName: string;
  storedDescriptor: number[]; // descriptor đã đăng ký
  onVerified: () => void;    // gọi khi xác nhận thành công
  onClose: () => void;
}

export default function FaceVerifyModal({ studentName, storedDescriptor, onVerified, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const [status, setStatus] = useState<'loading' | 'scanning' | 'matched' | 'failed' | 'error'>('loading');
  const [msg, setMsg] = useState('Đang tải model...');
  const [faceDetected, setFaceDetected] = useState(false);
  const [attempts, setAttempts] = useState(0);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setMsg('Đang tải model nhận dạng...');
        const { loadFaceApi } = await import('@/lib/faceApi');
        await loadFaceApi();

        if (cancelled) return;

        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: 640, height: 480 },
        });

        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }

        setStatus('scanning');
        setMsg('Nhìn thẳng vào camera để xác nhận danh tính...');
      } catch (e: any) {
        if (!cancelled) {
          setStatus('error');
          setMsg('Không thể truy cập camera: ' + (e?.message || ''));
        }
      }
    })();

    return () => {
      cancelled = true;
      if (timerRef.current) clearInterval(timerRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  useEffect(() => {
    if (status !== 'scanning') return;

    const scan = async () => {
      if (!videoRef.current || videoRef.current.readyState < 2) return;

      try {
        const { getFaceApi } = await import('@/lib/faceApi');
        const faceapi = await getFaceApi();

        const detection = await faceapi
          .detectSingleFace(videoRef.current, new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.5 }))
          .withFaceLandmarks(true)
          .withFaceDescriptor();

        if (!detection) {
          setFaceDetected(false);
          setMsg('Không thấy mặt — hãy nhìn thẳng vào camera');
          return;
        }

        setFaceDetected(true);
        const liveDescriptor = Array.from(detection.descriptor);
        const dist = euclideanDistance(liveDescriptor, storedDescriptor);

        setAttempts((a) => a + 1);

        if (dist <= THRESHOLD) {
          // Match!
          if (timerRef.current) clearInterval(timerRef.current);
          streamRef.current?.getTracks().forEach((t) => t.stop());
          setStatus('matched');
          setMsg(`Xác nhận thành công! (độ tương đồng: ${Math.round((1 - dist) * 100)}%)`);
          setTimeout(() => onVerified(), 900);
        } else {
          setMsg(`Khuôn mặt chưa khớp (khoảng cách: ${dist.toFixed(3)}). Giữ mặt trong khung...`);
        }
      } catch {
        // silent
      }
    };

    timerRef.current = setInterval(scan, 600);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [status, storedDescriptor, onVerified]);

  const handleSkip = () => {
    // Cho phép bỏ qua nếu camera bị lỗi hoặc admin muốn override
    if (timerRef.current) clearInterval(timerRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    onVerified();
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <div className={styles.title}>Xác nhận khuôn mặt</div>
          <div className={styles.sub}>Điểm danh cho: <strong>{studentName}</strong></div>
        </div>

        <div className={`${styles.cameraWrap} ${status === 'scanning' ? styles.scanning : ''} ${status === 'matched' ? styles.matched : ''} ${status === 'failed' ? styles.failed : ''}`}>
          <video ref={videoRef} className={styles.video} autoPlay muted playsInline />
          <div className={styles.overlay2}>
            <div className={`${styles.focusRing} ${faceDetected ? styles.focusRingActive : ''} ${status === 'matched' ? styles.focusRingMatched : ''}`} />
          </div>
        </div>

        {/* Status */}
        <div className={`${styles.statusBar} ${status === 'matched' ? styles.statusBarMatch : status === 'failed' ? styles.statusBarFail : ''}`}>
          <div className={`${styles.dot} ${
            status === 'matched' ? styles.dotMatch :
            status === 'failed' ? styles.dotFail :
            faceDetected ? styles.dotDetected : styles.dotScanning
          }`} />
          <span>{msg}</span>
        </div>

        {attempts > 8 && status === 'scanning' && (
          <div className={styles.skipNote}>
            Gặp khó khăn với camera?
          </div>
        )}

        <div className={styles.actions}>
          <button className={styles.cancelBtn} onClick={onClose}>Hủy</button>
          {(status === 'error' || attempts > 10) && (
            <button className={styles.skipBtn} onClick={handleSkip}>
              Bỏ qua xác nhận mặt
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
