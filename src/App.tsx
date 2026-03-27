import { useState, useEffect, useRef, useCallback } from "react";

// --- サウンド設定 (JSON形式で簡単に切り替え可能) ---
const SOUND_CONFIG = {
  finish: "/assets/cat4.mp3", // タイマー終了時
  start: "/assets/cat3.mp3", // スタートボタン押下時
  pause: "/assets/cat2.mp3", // 一時停止ボタン押下時
  reset: "/assets/cat3.mp3", // リセットボタン押下時
  touch: ["/assets/cat1.mp3", "/assets/cat2.mp3"],
};

export default function App() {
  const [timeLeft, setTimeLeft] = useState(0);
  const [initialTime, setInitialTime] = useState(0);
  const [isActive, setIsActive] = useState(false);
  const [isFinished, setIsFinished] = useState(false);

  // 音声を再生するための共通関数
  const playSound = useCallback((type: keyof typeof SOUND_CONFIG) => {
    // touchの場合は配列なので、特定のキーのみ処理する
    if (type === "touch") return;
    const audio = new Audio(SOUND_CONFIG[type] as string);
    audio.currentTime = 0;
    audio.play().catch((e) => console.log("Audio play blocked by browser", e));
  }, []);

  // タップ（耳・顔）時にランダムな猫の声を再生する関数
  const playRandomTouchSound = useCallback(() => {
    const touchSounds = SOUND_CONFIG.touch;
    const randomSound =
      touchSounds[Math.floor(Math.random() * touchSounds.length)];
    const audio = new Audio(randomSound);
    audio.currentTime = 0;
    audio.play().catch((e) => console.log("Audio play blocked", e));
  }, []);

  // タイマーロジック (1秒ごとにカウントダウン)
  useEffect(() => {
    let interval: number | undefined;
    if (isActive && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            setIsActive(false);
            setIsFinished(true);
            playSound("finish"); // 終了時の音
            if (navigator.vibrate) navigator.vibrate([300, 100, 300]);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isActive, timeLeft, playSound]);

  // --- 肉球ダイヤル操作ロジック (1回転20分 = 1200秒 固定) ---
  const leftPawRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const startAngle = useRef(0);
  const startTimeLeft = useRef(0);
  const lastAngle = useRef(0);
  const accumulatedDelta = useRef(0);

  const getAngle = useCallback(
    (
      clientX: number,
      clientY: number,
      ref: React.RefObject<HTMLDivElement>,
    ) => {
      if (!ref.current) return 0;
      const rect = ref.current.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      return Math.atan2(clientY - centerY, clientX - centerX);
    },
    [],
  );

  const handleDialStart = useCallback(
    (clientX: number, clientY: number) => {
      if (isActive) return;
      isDragging.current = true;
      startAngle.current = getAngle(clientX, clientY, leftPawRef);
      lastAngle.current = startAngle.current;
      startTimeLeft.current = timeLeft;
      accumulatedDelta.current = 0;
      setIsFinished(false);
    },
    [isActive, timeLeft, getAngle],
  );

  const handleDialMove = useCallback(
    (clientX: number, clientY: number) => {
      if (!isDragging.current || isActive) return;
      const currentAngle = getAngle(clientX, clientY, leftPawRef);

      let delta = currentAngle - lastAngle.current;
      if (delta > Math.PI) delta -= 2 * Math.PI;
      if (delta < -Math.PI) delta += 2 * Math.PI;

      accumulatedDelta.current += delta;
      lastAngle.current = currentAngle;

      const secondsPerRadian = 1200 / (2 * Math.PI);
      const rawNextTime =
        startTimeLeft.current + accumulatedDelta.current * secondsPerRadian;

      const stepped = Math.round(rawNextTime / 30) * 30;
      const finalSeconds = Math.max(0, Math.min(1200, stepped));

      setTimeLeft(finalSeconds);
      setInitialTime(finalSeconds);
    },
    [isActive, getAngle],
  );

  const handleDialEnd = useCallback(() => {
    isDragging.current = false;
  }, []);

  useEffect(() => {
    const onMove = (e: any) => {
      const x = e.clientX ?? e.touches?.[0]?.clientX;
      const y = e.clientY ?? e.touches?.[0]?.clientY;
      if (x != null && y != null) handleDialMove(x, y);
    };
    const onEnd = handleDialEnd;
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onEnd);
    document.addEventListener("touchmove", onMove, { passive: false });
    document.addEventListener("touchend", onEnd);
    return () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onEnd);
      document.removeEventListener("touchmove", onMove);
      document.removeEventListener("touchend", onEnd);
    };
  }, [handleDialMove, handleDialEnd]);

  const pawRotation = (timeLeft / 1200) * 360;
  const progress = initialTime > 0 ? timeLeft / initialTime : 0;
  const radius = 110;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - progress);

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center p-4 select-none overflow-hidden"
      style={{
        background:
          "linear-gradient(160deg, #FFF8E7 0%, #FFE8C8 50%, #FFD9B0 100%)",
        fontFamily: "'Courier New', monospace",
      }}
    >
      <div className="flex flex-col items-center gap-8 w-full max-w-sm relative">
        {/* --- 猫の顔セクション --- */}
        <div className="relative" style={{ width: 280, height: 280 }}>
          {/* 耳：メーターの外側かつ背後に配置 */}
          <div
            className="absolute cursor-pointer active:scale-110 transition-transform"
            onClick={playRandomTouchSound}
            style={{
              top: -15,
              left: 10,
              width: 75,
              height: 75,
              background: "#A8753A",
              borderRadius: "20% 80% 20% 20%",
              transform: "rotate(-40deg)",
              zIndex: 0,
            }}
          >
            <div
              style={{
                position: "absolute",
                top: 12,
                left: 12,
                width: 45,
                height: 45,
                background: "#FFDADA",
                borderRadius: "20% 80% 20% 20%",
              }}
            />
          </div>
          <div
            className="absolute cursor-pointer active:scale-110 transition-transform"
            onClick={playRandomTouchSound}
            style={{
              top: -15,
              right: 10,
              width: 75,
              height: 75,
              background: "#A8753A",
              borderRadius: "80% 20% 20% 20%",
              transform: "rotate(40deg)",
              zIndex: 0,
            }}
          >
            <div
              style={{
                position: "absolute",
                top: 12,
                right: 12,
                width: 45,
                height: 45,
                background: "#FFDADA",
                borderRadius: "80% 20% 20% 20%",
              }}
            />
          </div>

          {/* メーター(SVG) */}
          <svg
            className="absolute inset-0"
            width="280"
            height="280"
            viewBox="0 0 280 280"
            style={{ transform: "rotate(-90deg)", zIndex: 5 }}
          >
            <circle
              cx="140"
              cy="140"
              r={radius}
              fill="none"
              stroke="#E8D5B0"
              strokeWidth="6"
            />
            <circle
              cx="140"
              cy="140"
              r={radius}
              fill="none"
              stroke={isFinished ? "#FF8C69" : "#C17F3A"}
              strokeWidth="10"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              style={{
                transition: isActive
                  ? "stroke-dashoffset 1s linear"
                  : "stroke-dashoffset 0.3s ease-out",
              }}
            />
          </svg>

          {/* シンプルな顔本体 */}
          <div
            className="cursor-pointer"
            onClick={playRandomTouchSound}
            style={{
              position: "absolute",
              inset: 35,
              background: "#FCD27A",
              borderRadius: "50%",
              border: "5px solid #C9965A",
              boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 10,
            }}
          >
            <div style={{ display: "flex", gap: 40, marginBottom: 8 }}>
              <div
                style={{
                  width: 22,
                  height: 22,
                  background: "#5C4429",
                  borderRadius: "50%",
                }}
              />
              <div
                style={{
                  width: 22,
                  height: 22,
                  background: "#5C4429",
                  borderRadius: "50%",
                }}
              />
            </div>
            <div
              style={{
                width: 16,
                height: 10,
                background: "#A88053",
                borderRadius: "20% 20% 80% 80%",
              }}
            />
            <div
              style={{
                marginTop: 8,
                fontSize: isFinished ? 22 : 40,
                fontWeight: 900,
                color: isFinished ? "#E05030" : "#6B4420",
                letterSpacing: "-1px",
                textShadow: "0 1px 2px rgba(0,0,0,0.1)",
              }}
            >
              {isFinished
                ? "🐾 終了!"
                : `${Math.floor(timeLeft / 60)}:${(timeLeft % 60).toString().padStart(2, "0")}`}
            </div>
            <div style={{ marginTop: 2 }}>
              <svg width="40" height="18" viewBox="0 0 44 22" fill="none">
                <path
                  d="M8 10 C8 16 16 19 22 19 C28 19 36 16 36 10"
                  stroke="#8B5035"
                  strokeWidth="3"
                  strokeLinecap="round"
                  fill="none"
                />
              </svg>
            </div>
            <div className="absolute left-2 top-1/2 space-y-3">
              <div className="w-10 h-0.5 bg-[#A88053] rotate-[15deg]"></div>
              <div className="w-10 h-0.5 bg-[#A88053]"></div>
              <div className="w-10 h-0.5 bg-[#A88053] rotate-[-15deg]"></div>
            </div>
            <div className="absolute right-2 top-1/2 space-y-3">
              <div className="w-10 h-0.5 bg-[#A88053] rotate-[-15deg]"></div>
              <div className="w-10 h-0.5 bg-[#A88053]"></div>
              <div className="w-10 h-0.5 bg-[#A88053] rotate-[15deg]"></div>
            </div>
          </div>
        </div>

        {/* --- 肉球セクション --- */}
        <div className="flex justify-between w-full px-2 gap-6">
          {/* 左肉球（ダイヤル） */}
          <div className="flex flex-col items-center gap-1">
            <div
              ref={leftPawRef}
              className="relative touch-none"
              style={{
                width: 160,
                height: 160,
                cursor: isActive ? "not-allowed" : "grab",
              }}
              onMouseDown={(e) => {
                e.preventDefault();
                handleDialStart(e.clientX, e.clientY);
              }}
              onTouchStart={(e) => {
                e.preventDefault();
                handleDialStart(e.touches[0].clientX, e.touches[0].clientY);
              }}
            >
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  transform: `rotate(${pawRotation}deg)`,
                  transition: isDragging.current
                    ? "none"
                    : "transform 0.3s ease-out",
                }}
              >
                {[
                  { top: 0, left: "50%", ml: -16, rot: 0 },
                  { top: 16, left: "20%", ml: -14, rot: -50 },
                  { top: 16, right: "20%", mr: -14, rot: 50 },
                  { top: 56, left: "4%", ml: -8, rot: -95 },
                  { top: 56, right: "4%", mr: -8, rot: 95 },
                ].map((pos, i) => (
                  <div
                    key={i}
                    style={{
                      position: "absolute",
                      width: 30,
                      height: 38,
                      background: "linear-gradient(160deg, #C9965A, #A87040)",
                      borderRadius: "50% 50% 45% 45%",
                      boxShadow: "0 3px 8px rgba(0,0,0,0.2)",
                      top: pos.top,
                      left: pos.left,
                      right: pos.right,
                      marginLeft: pos.ml,
                      marginRight: pos.mr,
                      transform: `rotate(${pos.rot}deg)`,
                    }}
                  />
                ))}
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (timeLeft > 0) {
                    const nextActive = !isActive;
                    setIsActive(nextActive);
                    setIsFinished(false);
                    playSound(nextActive ? "start" : "pause"); // 音再生
                  }
                }}
                style={{
                  position: "absolute",
                  top: "50%",
                  left: "50%",
                  transform: "translate(-50%, -40%)",
                  width: 82,
                  height: 68,
                  background: isActive ? "#8B5535" : "#7B4A2A",
                  borderRadius: "42% 42% 52% 52%",
                  border: "none",
                  boxShadow: "0 6px 16px rgba(0,0,0,0.3)",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  zIndex: 20,
                }}
              >
                {isActive ? (
                  <div className="flex gap-2">
                    <div
                      style={{
                        width: 8,
                        height: 24,
                        background: "white",
                        borderRadius: 4,
                      }}
                    />
                    <div
                      style={{
                        width: 8,
                        height: 24,
                        background: "white",
                        borderRadius: 4,
                      }}
                    />
                  </div>
                ) : (
                  <div
                    style={{
                      width: 0,
                      height: 0,
                      borderTop: "11px solid transparent",
                      borderBottom: "11px solid transparent",
                      borderLeft: "20px solid white",
                      marginLeft: 4,
                    }}
                  />
                )}
              </button>
            </div>
          </div>

          {/* 右肉球（リセット） */}
          <div className="flex flex-col items-center gap-1">
            <div className="relative" style={{ width: 160, height: 160 }}>
              <div style={{ position: "absolute", inset: 0, opacity: 0.35 }}>
                {[
                  { top: 0, left: "50%", ml: -16, rot: 0 },
                  { top: 16, left: "20%", ml: -14, rot: -50 },
                  { top: 16, right: "20%", mr: -14, rot: 50 },
                ].map((pos, i) => (
                  <div
                    key={i}
                    style={{
                      position: "absolute",
                      width: 30,
                      height: 38,
                      background: "linear-gradient(160deg, #C9965A, #A87040)",
                      borderRadius: "50% 50% 45% 45%",
                      top: pos.top,
                      left: pos.left,
                      right: pos.right,
                      marginLeft: pos.ml,
                      marginRight: pos.mr,
                      transform: `rotate(${pos.rot}deg)`,
                    }}
                  />
                ))}
              </div>
              <button
                onClick={() => {
                  setIsActive(false);
                  setTimeLeft(0);
                  setInitialTime(0);
                  setIsFinished(false);
                  playSound("reset"); // 音再生
                }}
                style={{
                  position: "absolute",
                  top: "50%",
                  left: "50%",
                  transform: "translate(-50%, -40%)",
                  width: 82,
                  height: 68,
                  background: "linear-gradient(160deg, #C9965A, #A87040)",
                  borderRadius: "42% 42% 52% 52%",
                  border: "none",
                  boxShadow: "0 6px 16px rgba(0,0,0,0.25)",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  zIndex: 20,
                }}
              >
                <svg
                  width="30"
                  height="30"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="white"
                  strokeWidth="2.8"
                  strokeLinecap="round"
                >
                  <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                  <path d="M3 3v5h5" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
