import { useState, useEffect, useRef, useCallback } from "react";

// --- サウンド設定 ---
const SOUND_CONFIG = {
  finish: "/assets/cat4.mp3",
  start: "/assets/cat3.mp3",
  pause: "/assets/cat2.mp3",
  reset: "/assets/cat3.mp3",
  touch0: "/assets/cat1.mp3",
  touch1: "/assets/cat3.mp3",
  touch2: "/assets/cat2.mp3",
};

export default function App() {
  const [timeLeft, setTimeLeft] = useState(0);
  const [initialTime, setInitialTime] = useState(0);
  const [isActive, setIsActive] = useState(false);
  const [isFinished, setIsFinished] = useState(false);
  const [isEyeOpen, setIsEyeOpen] = useState(true);

  // --- 音声管理ロジック ---
  const soundPlayers = useRef<{ [key: string]: HTMLAudioElement }>({});
  const audioUnlocked = useRef(false);

  useEffect(() => {
    Object.entries(SOUND_CONFIG).forEach(([key, url]) => {
      const audio = new Audio(url);
      audio.preload = "auto";
      soundPlayers.current[key] = audio;
    });
  }, []);

  const playSound = useCallback((type: string) => {
    const audio = soundPlayers.current[type];
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
      audio.play().catch((e) => console.log("Audio play blocked", e));
    }
  }, []);

  const unlockAudio = useCallback(() => {
    if (audioUnlocked.current) return;
    Object.values(soundPlayers.current).forEach((audio) => {
      audio
        .play()
        .then(() => {
          audio.pause();
          audio.currentTime = 0;
        })
        .catch(() => {});
    });
    audioUnlocked.current = true;
  }, []);

  const playRandomTouchSound = useCallback(() => {
    unlockAudio();
    const randomIndex = Math.floor(Math.random() * 3);
    playSound(`touch${randomIndex}`);
  }, [unlockAudio, playSound]);

  // 【重要】終了音トリガー：依存配列を最小限にして確実に発火させる
  useEffect(() => {
    if (isFinished) {
      playSound("finish");
    }
  }, [isFinished]); // playSoundはあえて依存に入れない（または安定させる）

  // まばたき
  useEffect(() => {
    if (isActive) return;
    let blinkTimeout: number;
    const blink = () => {
      setIsEyeOpen(false);
      setTimeout(() => setIsEyeOpen(true), 150);
      blinkTimeout = window.setTimeout(blink, 3000 + Math.random() * 4000);
    };
    blinkTimeout = window.setTimeout(blink, 3000);
    return () => clearTimeout(blinkTimeout);
  }, [isActive]);

  // タイマー
  useEffect(() => {
    let interval: number | undefined;
    if (isActive && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft((prev) => {
          const nextValue = prev - 1;
          if (nextValue <= 0) {
            setIsActive(false);
            setIsFinished(true);
            if (navigator.vibrate) navigator.vibrate([300, 100, 300]);
            return 0;
          }
          setIsEyeOpen((prevEye) => !prevEye);
          return nextValue;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isActive]);

  // --- 肉球ダイヤル操作ロジック ---
  const leftPawRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const startAngle = useRef(0);
  const startTimeLeft = useRef(0);
  const lastAngle = useRef(0);
  const accumulatedDelta = useRef(0);

  // 【修正点】Refの型をHTMLDivElement | nullを受け入れるように変更
  const getAngle = useCallback(
    (
      clientX: number,
      clientY: number,
      ref: React.RefObject<HTMLDivElement | null>,
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
      unlockAudio();
      isDragging.current = true;
      const angle = getAngle(clientX, clientY, leftPawRef);
      startAngle.current = angle;
      lastAngle.current = angle;
      startTimeLeft.current = timeLeft;
      accumulatedDelta.current = 0;
      setIsFinished(false);
    },
    [isActive, timeLeft, getAngle, unlockAudio],
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
      setTimeLeft(Math.max(0, Math.min(1200, stepped)));
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
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", handleDialEnd);
    document.addEventListener("touchmove", onMove, { passive: false });
    document.addEventListener("touchend", handleDialEnd);
    return () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", handleDialEnd);
      document.removeEventListener("touchmove", onMove);
      document.removeEventListener("touchend", handleDialEnd);
    };
  }, [handleDialMove, handleDialEnd]);

  const pawRotation = (timeLeft / 1200) * 360;
  const progress = initialTime > 0 ? timeLeft / initialTime : 0;
  const radius = 110;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - progress);

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center p-4 select-none overflow-hidden transition-all duration-700"
      style={{
        background: isFinished
          ? "linear-gradient(160deg, #E5E7EB 0%, #D1D5DB 100%)"
          : "linear-gradient(160deg, #FFF8E7 0%, #FFE8C8 50%, #FFD9B0 100%)",
        fontFamily: "'Courier New', monospace",
      }}
    >
      <div className="flex flex-col items-center gap-8 w-full max-w-sm relative">
        {/* 猫の顔セクション */}
        <div className="relative" style={{ width: 280, height: 280 }}>
          {/* 耳 */}
          {["left", "right"].map((side) => (
            <div
              key={side}
              className="absolute cursor-pointer active:scale-110 transition-transform"
              onClick={playRandomTouchSound}
              style={{
                top: -15,
                [side]: 10,
                width: 75,
                height: 75,
                background: isFinished ? "#9CA3AF" : "#A8753A",
                borderRadius:
                  side === "left" ? "20% 80% 20% 20%" : "80% 20% 20% 20%",
                transform: `rotate(${side === "left" ? -40 : 40}deg)`,
                transformOrigin:
                  side === "left" ? "bottom right" : "bottom left",
                zIndex: 0,
                transition: "background 0.7s",
                animation:
                  isActive && !isFinished
                    ? `ear-wiggle-${side} 1s ease-in-out infinite`
                    : "none",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  top: 12,
                  [side]: 12,
                  width: 45,
                  height: 45,
                  background: isFinished ? "#D1D5DB" : "#FFDADA",
                  borderRadius:
                    side === "left" ? "20% 80% 20% 20%" : "80% 20% 20% 20%",
                }}
              />
            </div>
          ))}

          {/* メーター */}
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
              stroke={isFinished ? "#9CA3AF" : "#E8D5B0"}
              strokeWidth="6"
            />
            <circle
              cx="140"
              cy="140"
              r={radius}
              fill="none"
              stroke={isFinished ? "#6B7280" : "#C17F3A"}
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

          {/* 顔本体 */}
          <div
            className="cursor-pointer transition-all duration-700"
            onClick={playRandomTouchSound}
            style={{
              position: "absolute",
              inset: 35,
              background: isFinished ? "#BDC3C7" : "#FCD27A",
              borderRadius: "50%",
              border: "5px solid",
              borderColor: isFinished ? "#95A5A6" : "#C9965A",
              boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 10,
            }}
          >
            {!isFinished ? (
              <>
                <div style={{ display: "flex", gap: 40, marginBottom: 8 }}>
                  {[1, 2].map((i) => (
                    <div
                      key={i}
                      style={{
                        width: 22,
                        height: isEyeOpen ? 22 : 4,
                        background: "#5C4429",
                        borderRadius: isEyeOpen ? "50%" : "2px",
                        transition: "height 0.1s, border-radius 0.1s",
                      }}
                    />
                  ))}
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
                    fontSize: 40,
                    fontWeight: 900,
                    color: "#6B4420",
                    letterSpacing: "-1px",
                  }}
                >
                  {Math.floor(timeLeft / 60)}:
                  {(timeLeft % 60).toString().padStart(2, "0")}
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
              </>
            ) : (
              <div className="flex flex-col items-center animate-bounce">
                <svg width="60" height="60" viewBox="0 0 24 24" fill="#4B5563">
                  <circle cx="12" cy="14" r="5" />
                  <circle cx="6" cy="8" r="2.5" />
                  <circle cx="10" cy="5" r="2.5" />
                  <circle cx="14" cy="5" r="2.5" />
                  <circle cx="18" cy="8" r="2.5" />
                </svg>
                <div
                  style={{
                    marginTop: 10,
                    fontSize: 16,
                    fontWeight: 900,
                    color: "#4B5563",
                  }}
                >
                  おわったにゃん
                </div>
              </div>
            )}
            {["left", "right"].map((side) => (
              <div
                key={side}
                className={`absolute ${side === "left" ? "left-2" : "right-2"} top-1/2 space-y-3 opacity-30`}
              >
                <div
                  className={`w-10 h-0.5 bg-gray-600 ${side === "left" ? "rotate-[15deg]" : "rotate-[-15deg]"}`}
                ></div>
                <div className="w-10 h-0.5 bg-gray-600"></div>
                <div
                  className={`w-10 h-0.5 bg-gray-600 ${side === "left" ? "rotate-[-15deg]" : "rotate-[15deg]"}`}
                ></div>
              </div>
            ))}
          </div>
        </div>

        {/* 肉球セクション（完璧と言っていただいた配置を完全維持） */}
        <div className="flex justify-between w-full px-2 gap-6">
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
                      background: isFinished
                        ? "#9CA3AF"
                        : "linear-gradient(160deg, #C9965A, #A87040)",
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
                onClick={(e) => {
                  e.stopPropagation();
                  unlockAudio();
                  if (timeLeft > 0) {
                    const next = !isActive;
                    setIsActive(next);
                    playSound(next ? "start" : "pause");
                  }
                }}
                style={{
                  position: "absolute",
                  top: "50%",
                  left: "50%",
                  transform: "translate(-50%, -40%)",
                  width: 82,
                  height: 68,
                  background: isFinished
                    ? "#6B7280"
                    : isActive
                      ? "#8B5535"
                      : "#7B4A2A",
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
                      background: isFinished
                        ? "#9CA3AF"
                        : "linear-gradient(160deg, #C9965A, #A87040)",
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
                  unlockAudio();
                  setIsActive(false);
                  setTimeLeft(0);
                  setInitialTime(0);
                  setIsFinished(false);
                  playSound("reset");
                }}
                style={{
                  position: "absolute",
                  top: "50%",
                  left: "50%",
                  transform: "translate(-50%, -40%)",
                  width: 82,
                  height: 68,
                  background: isFinished
                    ? "#4B5563"
                    : "linear-gradient(160deg, #C9965A, #A87040)",
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

      <style>{`
        @keyframes ear-wiggle-left { 0%, 100% { transform: rotate(-40deg); } 50% { transform: rotate(-55deg); } }
        @keyframes ear-wiggle-right { 0%, 100% { transform: rotate(40deg); } 50% { transform: rotate(55deg); } }
      `}</style>
    </div>
  );
}
