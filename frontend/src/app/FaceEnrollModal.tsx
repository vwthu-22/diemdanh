'use client';
import { useRef, useState, useEffect } from 'react';
import styles from './faceenroll.module.css';

const CAPTURE_NEEDED = 3; // 3 clear samples is fast and accurate
const DETECT_INTERVAL = 250; // 250ms for responsive tracking

interface Props {
  studentName: string;
  onSave: (descriptor: number[]) => void;
  onClose: () => void;
}

export default function FaceEnrollModal({ studentName, onSave, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const [status, setStatus] = useState<'loading' | 'ready' | 'detecting' | 'captured' | 'error'>('loading');
  const [statusMsg, setStatusMsg] = useState('Đang tải mô hình nhận diện AI...');
  const [faceDetected, setFaceDetected] = useState(false);
  const [captures, setCaptures] = useState<number[][]>([]);
  const [saving, setSaving] = useState(false);

  const capturesRef = useRef<number[][]>([]);
  capturesRef.current = captures;

  // Load models & start camera
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setStatusMsg('Đang tải mô hình AI...');
        const { loadFaceApi } = await import('@/lib/faceApi');
        await loadFaceApi();

        if (cancelled) return;

        setStatusMsg('Đang mở camera...');
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
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

        setStatus('ready');
        setStatusMsg('Nhìn thẳng vào khung hình để đăng ký khuôn mặt');
      } catch (e: any) {
        if (!cancelled) {
          setStatus('error');
          setStatusMsg('Không thể mở camera. Vui lòng cấp quyền truy cập camera cho trình duyệt.');
        }
      }
    })();

    return () => {
      cancelled = true;
      if (timerRef.current) clearInterval(timerRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  // Continuous face detection
  useEffect(() => {
    if (status !== 'ready' && status !== 'detecting') return;

    const detect = async () => {
      if (!videoRef.current || videoRef.current.readyState < 2) return;
      if (capturesRef.current.length >= CAPTURE_NEEDED) return;

      try {
        const { getFaceApi } = await import('@/lib/faceApi');
        const faceapi = await getFaceApi();

        const detection = await faceapi
          .detectSingleFace(videoRef.current, new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.5 }))
          .withFaceLandmarks(true)
          .withFaceDescriptor();

        if (!detection) {
          setFaceDetected(false);
          if (capturesRef.current.length === 0) {
            setStatusMsg('Không thấy khuôn mặt — vui lòng nhìn thẳng camera');
          }
          return;
        }

        setFaceDetected(true);
        setStatus('detecting');

        // Capture sample
        const desc = Array.from(detection.descriptor);
        setCaptures((prev) => {
          if (prev.length >= CAPTURE_NEEDED) return prev;
          const next = [...prev, desc];
          const remaining = CAPTURE_NEEDED - next.length;
          if (remaining > 0) {
            setStatusMsg(`Giữ nguyên... Đang thu thập mẫu (${next.length}/${CAPTURE_NEEDED})`);
          } else {
            setStatusMsg('Đã quét xong khuôn mặt! Nhấn "Lưu khuôn mặt" để hoàn tất.');
            setStatus('captured');
          }
          return next;
        });
      } catch {
        // silent detection error
      }
    };

    timerRef.current = setInterval(detect, DETECT_INTERVAL);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [status]);

  // Compute average descriptor from samples
  const computeAverageDescriptor = (samples: number[][]): number[] => {
    const len = samples[0].length;
    const avg = new Array(len).fill(0);
    for (const s of samples) {
      for (let i = 0; i < len; i++) avg[i] += s[i];
    }
    return avg.map((v) => v / samples.length);
  };

  const handleSave = async () => {
    if (captures.length < CAPTURE_NEEDED) return;
    setSaving(true);
    const avgDescriptor = computeAverageDescriptor(captures);
    onSave(avgDescriptor);
  };

  const handleRetry = () => {
    setCaptures([]);
    capturesRef.current = [];
    setFaceDetected(false);
    setStatus('ready');
    setStatusMsg('Nhìn thẳng vào khung hình để đăng ký lại');
  };

  const progressPercent = Math.min(100, Math.round((captures.length / CAPTURE_NEEDED) * 100));

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className={styles.header}>
          <div className={styles.titleWrap}>
            <span className={styles.icon}>📷</span>
            <div>
              <h3 className={styles.title}>Đăng ký khuôn mặt</h3>
              <p className={styles.subtitle}>{studentName}</p>
            </div>
          </div>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Đóng">✕</button>
        </div>

        {/* Camera viewport */}
        <div className={`${styles.viewport} ${faceDetected ? styles.detected : ''} ${status === 'captured' ? styles.complete : ''}`}>
          <video
            ref={videoRef}
            className={styles.video}
            autoPlay
            muted
            playsInline
          />
          <canvas ref={canvasRef} className={styles.canvas} />

          {/* Oval guide */}
          <div className={styles.guideOval}>
            <div className={styles.scanLine} />
          </div>

          {/* Complete checkmark */}
          {status === 'captured' && (
            <div className={styles.completeOverlay}>
              <div className={styles.checkCircle}>✓</div>
              <span>Thu thập hoàn tất!</span>
            </div>
          )}

          {/* Loading state */}
          {status === 'loading' && (
            <div className={styles.loadingOverlay}>
              <div className={styles.spinner} />
              <span>{statusMsg}</span>
            </div>
          )}
        </div>

        {/* Status Bar */}
        <div className={styles.statusBar}>
          <div className={`${styles.statusDot} ${faceDetected ? styles.statusDotActive : ''}`} />
          <span className={styles.statusText}>{statusMsg}</span>
        </div>

        {/* Progress Bar */}
        <div className={styles.progressSection}>
          <div className={styles.progressInfo}>
            <span>Mẫu khuôn mặt</span>
            <span className={styles.progressPercent}>{captures.length}/{CAPTURE_NEEDED}</span>
          </div>
          <div className={styles.progressBar}>
            <div className={styles.progressFill} style={{ width: `${progressPercent}%` }} />
          </div>
        </div>

        {/* Actions */}
        <div className={styles.actions}>
          {status === 'captured' ? (
            <>
              <button className={`${styles.btn} ${styles.btnSecondary}`} onClick={handleRetry}>
                Quét lại
              </button>
              <button
                className={`${styles.btn} ${styles.btnPrimary}`}
                onClick={handleSave}
                disabled={saving}
              >
                {saving ? 'Đang lưu...' : 'Lưu khuôn mặt'}
              </button>
            </>
          ) : (
            <button className={`${styles.btn} ${styles.btnGhost}`} onClick={onClose}>
              Hủy
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
