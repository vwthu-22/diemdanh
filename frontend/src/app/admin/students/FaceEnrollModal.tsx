'use client';
import { useRef, useState, useEffect, useCallback } from 'react';
import styles from './students.module.css';

const CAPTURE_NEEDED = 5; // số mẫu cần chụp để lấy descriptor trung bình
const DETECT_INTERVAL = 400; // ms giữa các lần detect

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
  const [statusMsg, setStatusMsg] = useState('Đang tải model nhận dạng...');
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
        setStatusMsg('Đang tải model AI nhận dạng khuôn mặt...');
        const { loadFaceApi } = await import('@/lib/faceApi');
        await loadFaceApi();

        if (cancelled) return;

        setStatusMsg('Đang kết nối camera...');
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

        setStatus('ready');
        setStatusMsg('Nhìn thẳng vào camera, giữ mặt trong khung oval');
      } catch (e: any) {
        if (!cancelled) {
          setStatus('error');
          setStatusMsg('Lỗi: ' + (e?.message || 'Không thể truy cập camera'));
        }
      }
    })();

    return () => {
      cancelled = true;
      if (timerRef.current) clearInterval(timerRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  // Start continuous face detection when camera ready
  useEffect(() => {
    if (status !== 'ready' && status !== 'detecting') return;

    const detect = async () => {
      if (!videoRef.current || videoRef.current.readyState < 2) return;
      if (capturesRef.current.length >= CAPTURE_NEEDED) return;

      try {
        const { getFaceApi } = await import('@/lib/faceApi');
        const faceapi = await getFaceApi();

        const detection = await faceapi
          .detectSingleFace(videoRef.current, new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.5 }))
          .withFaceLandmarks(true)
          .withFaceDescriptor();

        if (!detection) {
          setFaceDetected(false);
          if (capturesRef.current.length === 0) {
            setStatusMsg('Không thấy khuôn mặt — hãy nhìn thẳng vào camera');
          }
          return;
        }

        setFaceDetected(true);
        setStatus('detecting');

        // Draw detection box on canvas
        if (canvasRef.current && videoRef.current) {
          const canvas = canvasRef.current;
          const video = videoRef.current;
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          // Don't draw anything — the oval guide is enough
        }

        // Capture sample
        const desc = Array.from(detection.descriptor);
        setCaptures((prev) => {
          if (prev.length >= CAPTURE_NEEDED) return prev;
          const next = [...prev, desc];
          const remaining = CAPTURE_NEEDED - next.length;
          if (remaining > 0) {
            setStatusMsg(`Giữ nguyên... Đang chụp mẫu (${next.length}/${CAPTURE_NEEDED})`);
          } else {
            setStatusMsg('Hoàn tất! Nhấn "Lưu khuôn mặt" để xác nhận.');
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

  // Tính descriptor trung bình từ các mẫu để tăng độ chính xác
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
    setStatusMsg('Nhìn thẳng vào camera, giữ mặt trong khung oval');
  };

  const dotClass =
    status === 'loading' || status === 'error'
      ? styles.statusDot
      : status === 'captured'
      ? styles.statusDotSaved
      : faceDetected
      ? styles.statusDotDetected
      : styles.statusDotActive;

  return (
    <div className={styles.faceModalOverlay} onClick={onClose}>
      <div className={styles.faceModal} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div>
          <h3 className={styles.faceModalTitle}>Đăng ký khuôn mặt</h3>
          <p className={styles.faceModalSubtitle}>{studentName}</p>
        </div>

        {/* Camera view */}
        <div
          className={`${styles.cameraWrap} ${
            status === 'ready' || status === 'detecting' ? styles.cameraActive : ''
          } ${faceDetected ? styles.faceDetected : ''}`}
        >
          <video
            ref={videoRef}
            className={styles.cameraVideo}
            autoPlay
            muted
            playsInline
          />
          <canvas ref={canvasRef} className={styles.cameraCanvas} />
          <div className={styles.cameraOverlay}>
            <div
              className={`${styles.faceFocusBox} ${faceDetected ? styles.faceFocusBoxDetected : ''}`}
            />
          </div>
        </div>

        {/* Status */}
        <div className={styles.cameraStatusBar}>
          <div className={`${styles.statusDot} ${dotClass}`} />
          <span>{statusMsg}</span>
        </div>

        {/* Capture progress */}
        {status === 'detecting' || status === 'captured' ? (
          <div className={styles.captureProgress}>
            <div className={styles.captureProgressLabel}>
              <span>Mẫu khuôn mặt</span>
              <span>{captures.length}/{CAPTURE_NEEDED}</span>
            </div>
            <div className={styles.captureProgressBar}>
              <div
                className={styles.captureProgressFill}
                style={{ width: `${(captures.length / CAPTURE_NEEDED) * 100}%` }}
              />
            </div>
          </div>
        ) : null}

        {/* Actions */}
        <div className={styles.faceModalActions}>
          {status === 'captured' && (
            <button className={`${styles.faceBtn} ${styles.faceBtnDanger}`} onClick={handleRetry}>
              Chụp lại
            </button>
          )}
          <button className={`${styles.faceBtn} ${styles.faceBtnGhost}`} onClick={onClose}>
            Hủy
          </button>
          <button
            className={`${styles.faceBtn} ${styles.faceBtnPrimary}`}
            disabled={captures.length < CAPTURE_NEEDED || saving}
            onClick={handleSave}
          >
            {saving ? 'Đang lưu...' : 'Lưu khuôn mặt'}
          </button>
        </div>
      </div>
    </div>
  );
}
