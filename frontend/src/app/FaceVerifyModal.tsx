'use client';
import { useRef, useState, useEffect, useCallback } from 'react';
import { euclideanDistance } from '@/lib/faceApi';
import styles from './faceverify.module.css';

const THRESHOLD = 0.52;

interface Props {
  studentName: string;
  storedDescriptor: number[];
  onVerified: () => void;
  onClose: () => void;
}

export default function FaceVerifyModal({ studentName, storedDescriptor, onVerified, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number>(0);
  const verifiedRef = useRef(false);

  const [phase, setPhase] = useState<'loading' | 'scanning' | 'matched' | 'error'>('loading');
  const [msg, setMsg] = useState('Đang tải model nhận diện...');
  const [faceDetected, setFaceDetected] = useState(false);
  const [progress, setProgress] = useState(0); // 0-100 confidence accumulation
  const progressRef = useRef(0);
  const [attempts, setAttempts] = useState(0);

  const stopAll = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
  }, []);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setMsg('Đang tải model nhận diện...');
        const { loadFaceApi } = await import('@/lib/faceApi');
        await loadFaceApi();
        if (cancelled) return;

        setMsg('Đang kết nối camera...');
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
        });
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }

        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        setPhase('scanning');
        setMsg('Nhìn thẳng vào camera...');
        startLoop();
      } catch (e: any) {
        if (!cancelled) {
          setPhase('error');
          setMsg('Không thể truy cập camera: ' + (e?.message || ''));
        }
      }
    })();

    return () => {
      cancelled = true;
      stopAll();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startLoop = useCallback(() => {
    let lastDetect = 0;
    const DETECT_EVERY_MS = 500; // chạy detect mỗi 500ms để không nặng

    const loop = async (now: number) => {
      if (verifiedRef.current) return;
      rafRef.current = requestAnimationFrame(loop);

      if (now - lastDetect < DETECT_EVERY_MS) return;
      lastDetect = now;

      const video = videoRef.current;
      if (!video || video.readyState < 2) return;

      try {
        const { getFaceApi } = await import('@/lib/faceApi');
        const faceapi = await getFaceApi();

        const det = await faceapi
          .detectSingleFace(video, new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.45 }))
          .withFaceLandmarks(true)
          .withFaceDescriptor();

        setAttempts((a) => a + 1);

        if (!det) {
          setFaceDetected(false);
          setMsg('Không thấy khuôn mặt — hãy nhìn thẳng vào camera');
          // giảm progress khi không thấy mặt
          progressRef.current = Math.max(0, progressRef.current - 5);
          setProgress(progressRef.current);
          return;
        }

        setFaceDetected(true);
        const live = Array.from(det.descriptor);
        const dist = euclideanDistance(live, storedDescriptor);

        if (dist <= THRESHOLD) {
          // Tăng progress dần khi khớp
          progressRef.current = Math.min(100, progressRef.current + 35);
          setProgress(progressRef.current);
          const confidence = Math.round((1 - dist) * 100);
          setMsg(`Đang xác nhận... (${confidence}% phù hợp)`);

          if (progressRef.current >= 100) {
            verifiedRef.current = true;
            stopAll();
            setPhase('matched');
            setMsg(`Xác nhận thành công! (${confidence}% phù hợp)`);
            setTimeout(() => onVerified(), 700);
          }
        } else {
          // Giảm progress khi không khớp
          progressRef.current = Math.max(0, progressRef.current - 8);
          setProgress(progressRef.current);
          const confidence = Math.round((1 - dist) * 100);
          setMsg(`Chưa nhận ra — ${confidence}% phù hợp. Giữ nguyên, đừng che mặt.`);
        }
      } catch {
        // silent
      }
    };

    rafRef.current = requestAnimationFrame(loop);
  }, [storedDescriptor, onVerified, stopAll]);

  const handleSkip = () => {
    stopAll();
    onVerified();
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <div className={styles.title}>Xác nhận khuôn mặt</div>
          <div className={styles.sub}>Điểm danh cho: <strong>{studentName}</strong></div>
        </div>

        <div className={`${styles.cameraWrap} ${phase === 'scanning' ? styles.scanning : ''} ${phase === 'matched' ? styles.matched : ''}`}>
          <video ref={videoRef} className={styles.video} autoPlay muted playsInline />
          <div className={styles.overlay2}>
            <div className={`${styles.focusRing} ${faceDetected ? styles.focusRingActive : ''} ${phase === 'matched' ? styles.focusRingMatched : ''}`} />
          </div>

          {/* Scanning animation overlay */}
          {phase === 'scanning' && (
            <div className={styles.scanLine} />
          )}

          {/* Match overlay */}
          {phase === 'matched' && (
            <div className={styles.matchOverlay}>
              <div className={styles.matchCheck}>✓</div>
            </div>
          )}
        </div>

        {/* Progress bar */}
        {phase === 'scanning' && (
          <div className={styles.progressWrap}>
            <div className={styles.progressBar}>
              <div
                className={styles.progressFill}
                style={{ width: `${progress}%`, transition: 'width 0.3s ease' }}
              />
            </div>
            <span className={styles.progressLabel}>
              {faceDetected ? (progress > 0 ? `${progress}%` : 'Đang phân tích...') : 'Chờ phát hiện mặt...'}
            </span>
          </div>
        )}

        {/* Status bar */}
        <div className={`${styles.statusBar} ${phase === 'matched' ? styles.statusBarMatch : ''}`}>
          <div className={`${styles.dot} ${
            phase === 'matched' ? styles.dotMatch :
            faceDetected ? styles.dotDetected : styles.dotScanning
          }`} />
          <span>{msg}</span>
        </div>

        <div className={styles.actions}>
          <button className={styles.cancelBtn} onClick={onClose}>Hủy</button>
          {(phase === 'error' || attempts > 12) && (
            <button className={styles.skipBtn} onClick={handleSkip}>
              Bỏ qua xác nhận mặt
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
