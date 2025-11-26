import React, { useEffect, useRef, useState, useMemo } from 'react';
import { createRoot } from 'react-dom/client';

// --- Constants & Types ---
const GRID_COLS = 5;
const GRID_ROWS = 4;
const UFO_EASING = 0.08;
const MAX_TILT = 25; // Slightly increased tilt for space drift feel
const BEAM_SPREAD = 0.6; // Wider cone
const BEAM_LENGTH = 1500; 
const UFO_FIXED_Y = 100; // Fixed Y position for the UFO

interface Position {
  x: number;
  y: number;
}

interface PolicyData {
  name: string;
  targetShort: string;
  probability: number;
  amount: string;
  duration: string;
  details: string[];
}

interface Particle {
  id: number;
  spawnTime: number; // For timing delays
  x: number;
  y: number;
  vx: number;
  vy: number;
  rotation: number;
  rotSpeed: number;
  color: string;
  life: number;
  width: number;
  height: number;
  // Logic properties
  isIncinerated: boolean;
  isChosen: boolean; // The one that gets pulled to the front
  burnProgress: number; // 0 to 1
  data?: PolicyData;
  read?: boolean;
}

const POLICY_LABELS = [
  "청년 주거", "취업 지원", "창업 자금", "교육비", 
  "심리 상담", "월세 지원", "교통비", "문화 예술", 
  "자산 형성", "역량 강화"
];

const DOC_COLORS = [
  "#FF6B6B", "#4ECDC4", "#45B7D1", "#FFA07A", "#98D8C8", "#F7D794"
];

// --- Mock Data Generators ---

const POLICY_DATA_MAP: Record<string, { amounts: string[], durations: string[], targets: string[], details: string[] }> = {
    "청년 주거": {
        amounts: ["보증금 최대 1억원", "월세 연 240만원 지급", "이사비 40만원 현금", "전세 대출이자 연 300만원", "공공임대 보증금 80%"],
        durations: ["최대 4년", "12개월 분할 지급", "즉시 지급", "2년 (연장 가능)", "계약 기간 동안"],
        targets: ["무주택 세대주 청년", "만 19~39세 1인 가구", "중위소득 60% 이하", "지방 거주 대학생", "신혼부부 및 예비부부"],
        details: ["임차보증금 3억원 이하 주택", "전입신고 필수", "부모님과 별도 거주 확인", "소득 기준 충족 시 즉시 지원"]
    },
    "취업 지원": {
        amounts: ["구직수당 월 50만원", "취업성공금 300만원", "자격증 응시료 100만원", "인턴 급여 월 250만원", "면접 준비금 30만원"],
        durations: ["6개월간 지급", "취업 후 1년 근속 시", "연간 한도 내", "최대 6개월 근무", "신청 즉시 지급"],
        targets: ["미취업 청년", "졸업예정자", "마지막 학기 재학생", "중소기업 재직자", "구직활동 등록자"],
        details: ["워크넷 구직 등록 필수", "관내 거주 확인서 제출", "실제 면접 응시 확인서 필요", "취업 후 3개월 근속 시 추가 인센티브"]
    },
    "창업 자금": {
        amounts: ["사업화 지원금 5,000만원", "임차보증금 2,000만원", "초기 창업비 1,000만원", "마케팅비 500만원", "저금리 융자 1억원"],
        durations: ["협약 기간 1년", "최대 2년", "일시 지급", "심사 후 결정", "5년 분할 상환"],
        targets: ["예비 창업자", "업력 3년 미만", "만 39세 이하 대표", "기술 기반 스타트업", "지역 특화 산업 분야"],
        details: ["사업계획서 심사 필수", "창업 교육 20시간 이수", "매출 발생 시 추가 지원", "전용 오피스 입주 혜택"]
    },
    "교육비": {
        amounts: ["학습 바우처 200만원", "도서 구입비 30만원", "IT 장비 구입비 150만원", "수강료 전액 (최대 500만원)", "어학 시험료 연 3회"],
        durations: ["사용 기한 1년", "연 1회 지급", "즉시 지급", "과정 수료 시", "신청 시 지급"],
        targets: ["대학생", "저소득층 청년", "비진학 청년", "직업 훈련 희망자", "학자금 대출 이용자"],
        details: ["출석률 80% 이상 필수", "수료증 제출 시 환급", "소득 분위 심사", "지정 교육기관 이용 시"]
    },
    "default": {
        amounts: ["생활안정자금 100만원", "복지 포인트 50만점", "긴급 생계비 200만원", "교통비 연 30만원", "활동비 월 30만원"],
        durations: ["즉시 지급", "반기별 지급", "일시 지급", "연 1회", "3개월간 지급"],
        targets: ["관내 거주 청년", "만 19~34세", "소득 요건 없음", "선착순 모집", "세대주"],
        details: ["신분증 사본 제출", "주민등록등본 1부", "통장 사본", "신청서 작성 필수"]
    }
};

const getRandomItem = (arr: string[]) => arr[Math.floor(Math.random() * arr.length)];

const generatePolicyData = (category: string): PolicyData => {
  const prob = Math.floor(Math.random() * 30) + 70; // 70-99%
  
  // Find matching category or use default
  let key = Object.keys(POLICY_DATA_MAP).find(k => category.includes(k)) || "default";
  if (category.includes("월세")) key = "청년 주거";
  if (category.includes("자산")) key = "default"; // Or specific
  if (category.includes("교통")) key = "default";
  
  const template = POLICY_DATA_MAP[key] || POLICY_DATA_MAP["default"];
  
  // Mix details from specific and generic
  const details = [
    getRandomItem(template.details),
    "대한민국 국적 소지자",
    getRandomItem(template.details),
    "타 지원사업과 중복 수혜 불가 (확인 필요)"
  ];

  return {
    name: `${category} 특별 지원`,
    targetShort: getRandomItem(template.targets),
    probability: prob,
    amount: getRandomItem(template.amounts),
    duration: getRandomItem(template.durations),
    details: details
  };
};

// --- Helper Functions ---

const isPointInBeam = (px: number, py: number, ux: number, uy: number): boolean => {
  const dy = py - uy;
  const dx = px - ux;
  
  // Must be below the UFO
  if (dy < 0) return false;
  
  // Must be within the cone spread
  const maxHalfWidth = dy * BEAM_SPREAD;
  return Math.abs(dx) < maxHalfWidth;
};

// Deterministic pseudo-random for particle effects
const pseudoRandom = (seed: number) => {
    const x = Math.sin(seed) * 10000;
    return x - Math.floor(x);
};

// --- Sub-components ---

const Stars = () => {
  const stars = useMemo(() => {
    return Array.from({ length: 80 }).map((_, i) => ({
      id: i,
      left: Math.random() * 100,
      top: Math.random() * 100,
      size: Math.random() * 2 + 1,
      opacity: Math.random() * 0.7 + 0.3,
      animationDuration: Math.random() * 3 + 2
    }));
  }, []);

  return (
    <div className="absolute inset-0 pointer-events-none z-0">
      {stars.map((s) => (
        <div
          key={s.id}
          className="absolute bg-white rounded-full opacity-50"
          style={{
            left: `${s.left}%`,
            top: `${s.top}%`,
            width: `${s.size}px`,
            height: `${s.size}px`,
            opacity: s.opacity,
            boxShadow: `0 0 ${s.size * 2}px rgba(255, 255, 255, 0.8)`
          }}
        />
      ))}
    </div>
  );
};

const FolderIcon = ({ highlighted, onClick, label }: { highlighted: boolean; onClick: () => void; label: string }) => {
  // Colors for text/badges
  const labelColor = highlighted ? "#451a03" : "#9ca3af";
  const labelBg = highlighted ? "#fef3c7" : "rgba(31, 41, 55, 0.5)";
  const labelBorder = highlighted ? "#fcd34d" : "transparent";

  return (
    <div
      onClick={onClick}
      className={`relative flex flex-col items-center justify-center transition-all duration-300 ease-out cursor-pointer select-none
        ${highlighted ? 'scale-110 opacity-100 z-10 brightness-110 drop-shadow-[0_0_15px_rgba(253,224,71,0.5)]' : 'scale-100 opacity-30 grayscale brightness-50 z-0'}
      `}
      style={{
        width: '120px',
        height: '100px',
      }}
    >
      {/* Provided SVG Folder Design */}
      <svg width="100%" height="100%" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className="overflow-visible">
        <path d="M10 20C10 14.4772 14.4772 10 20 10H40L50 20H80C85.5228 20 90 24.4772 90 30V80C90 85.5228 85.5228 90 80 90H20C14.4772 90 10 85.5228 10 80V20Z" fill="#FCE883"/>
        <circle cx="50" cy="55" r="15" fill="#FDD835"/>
        <path d="M50 40C58.2843 40 65 46.7157 65 55C65 63.2843 58.2843 70 50 70C41.7157 70 35 63.2843 35 55" stroke="#FBC02D" strokeWidth="5" strokeLinecap="round"/>
      </svg>

      <div 
        className={`absolute -bottom-8 text-[11px] font-bold py-1 px-3 rounded-full pointer-events-none transition-all duration-300 transform border
          ${highlighted ? 'translate-y-0 opacity-100' : '-translate-y-2 opacity-0'}
        `}
        style={{
            backgroundColor: labelBg,
            color: labelColor,
            borderColor: labelBorder
        }}
      >
        {label}
      </div>
    </div>
  );
};

const UFO = ({ tilt }: { tilt: number }) => (
  <div
    className="pointer-events-none absolute w-32 h-20 z-50 will-change-transform"
    style={{
      transform: `translate(-50%, -50%) rotate(${tilt}deg)`,
    }}
  >
    <div className="relative w-full h-full flex items-center justify-center">
        <div className="absolute top-0 w-16 h-12 bg-black rounded-full z-10" style={{ transform: 'translateY(4px)' }}></div>
        <div className="absolute top-8 w-28 h-8 bg-[#007AFF] rounded-[50%] z-20 shadow-[0_0_20px_rgba(0,122,255,0.6)] border-2 border-blue-600"></div>
        <div className="absolute top-10 w-16 h-6 bg-white rounded-[50%] z-30 shadow-[0_0_25px_rgba(255,255,255,1)]"></div>
        <div className="absolute top-10 w-24 flex justify-between px-2 z-30 opacity-90">
            <div className="w-1.5 h-1.5 bg-cyan-200 rounded-full animate-pulse"></div>
            <div className="w-1.5 h-1.5 bg-cyan-200 rounded-full animate-pulse delay-75"></div>
            <div className="w-1.5 h-1.5 bg-cyan-200 rounded-full animate-pulse delay-150"></div>
        </div>
    </div>
  </div>
);

const PolicyModal = ({ data, onClose }: { data: PolicyData, onClose: () => void }) => {
  const [showMore, setShowMore] = useState(false);

  // Stop propagation to prevent clicks from closing audio or spawning things
  const handleContentClick = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  return (
    <div 
      className="fixed inset-0 z-[100] flex items-center justify-center animate-overlay cursor-default"
      onClick={onClose}
    >
      <div 
        onClick={handleContentClick}
        className="bg-white rounded-2xl p-6 w-[90%] max-w-md shadow-[0_0_40px_rgba(253,224,71,0.2)] border border-yellow-100 relative animate-modal"
      >
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
        >
          <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <div className="animate-content-1">
          <h2 className="text-xl font-bold text-gray-900 mb-1">{data.name}</h2>
          <div className="flex items-center gap-2 mb-4">
            <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-semibold rounded-full">추천 정책</span>
            <span className="text-xs text-gray-500">매칭 확률 {data.probability}%</span>
          </div>

          <div className="space-y-4">
            <div className="bg-gray-50 p-3 rounded-lg">
              <p className="text-xs text-gray-500 mb-1">대상 조건</p>
              <p className="text-sm font-medium text-gray-800 leading-snug">{data.targetShort}</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-yellow-50 p-3 rounded-lg border border-yellow-100">
                <p className="text-xs text-yellow-700 mb-1">지원 혜택</p>
                <p className="text-sm font-bold text-gray-900">{data.amount}</p>
              </div>
              <div className="bg-green-50 p-3 rounded-lg border border-green-100">
                <p className="text-xs text-green-700 mb-1">예상 기간</p>
                <p className="text-sm font-bold text-gray-900">{data.duration}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-5 pt-4 border-t border-gray-100 animate-content-2">
           <button 
             onClick={() => setShowMore(!showMore)}
             className="flex items-center text-xs font-semibold text-gray-500 hover:text-gray-800 transition-colors"
           >
             {showMore ? '상세 조건 접기' : '상세 조건 더보기'}
             <svg 
              className={`ml-1 w-4 h-4 transition-transform ${showMore ? 'rotate-180' : ''}`} 
              fill="none" viewBox="0 0 24 24" stroke="currentColor"
             >
               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
             </svg>
           </button>
           
           {showMore && (
             <ul className="mt-3 space-y-2">
               {data.details.map((detail, idx) => (
                 <li key={idx} className="text-xs text-gray-600 flex items-start">
                   <span className="mr-2 text-gray-400">•</span>
                   {detail}
                 </li>
               ))}
             </ul>
           )}
        </div>
        
        <div className="animate-content-3">
          <button 
            className="w-full mt-6 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl transition-colors text-sm shadow-lg shadow-blue-200"
            onClick={() => window.open('https://www.moel.go.kr', '_blank')}
          >
            신청하러 가기
          </button>
        </div>
      </div>
    </div>
  );
};

// --- Main App ---

const App = () => {
  // State
  const [mousePos, setMousePos] = useState<Position>({ x: window.innerWidth / 2, y: UFO_FIXED_Y });
  const [ufoPos, setUfoPos] = useState<Position>({ x: window.innerWidth / 2, y: UFO_FIXED_Y });
  const [tilt, setTilt] = useState(0);
  
  const [files, setFiles] = useState<{id: string, label: string}[]>([]);
  const [highlightedFiles, setHighlightedFiles] = useState<Set<number>>(new Set());

  const [particles, setParticles] = useState<Particle[]>([]);
  const [collectedCards, setCollectedCards] = useState<Particle[]>([]);
  const [selectedPolicy, setSelectedPolicy] = useState<PolicyData | null>(null);
  const [tractorBeamTarget, setTractorBeamTarget] = useState<{x: number, y: number} | null>(null);
  
  // Game Stats
  const [stats, setStats] = useState({ explored: 0, filtered: 0 });

  const ufoPosRef = useRef(ufoPos);
  const mousePosRef = useRef({ x: window.innerWidth / 2, y: UFO_FIXED_Y });
  const requestRef = useRef<number>();
  const fileRefs = useRef<(HTMLDivElement | null)[]>([]);

  // Audio Refs
  const audioCtxRef = useRef<AudioContext | null>(null);
  const engineOscRef = useRef<OscillatorNode | null>(null);
  const engineGainRef = useRef<GainNode | null>(null);

  const initAudio = () => {
    if (audioCtxRef.current) return;
    try {
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioContext();
      audioCtxRef.current = ctx;

      const droneOsc = ctx.createOscillator();
      const droneGain = ctx.createGain();
      droneOsc.type = 'sine';
      droneOsc.frequency.value = 80; 
      droneGain.gain.value = 0.05; 
      droneOsc.connect(droneGain);
      droneGain.connect(ctx.destination);
      droneOsc.start();
      
      const engineOsc = ctx.createOscillator();
      const engineGain = ctx.createGain();
      engineOsc.type = 'triangle';
      engineOsc.frequency.value = 150;
      engineGain.gain.value = 0; 
      engineOsc.connect(engineGain);
      engineGain.connect(ctx.destination);
      engineOsc.start();
      
      engineOscRef.current = engineOsc;
      engineGainRef.current = engineGain;
    } catch (e) {
      console.error("Audio init failed", e);
    }
  };

  const playSoundEffect = (type: 'pop' | 'scan' | 'burn' | 'tractor') => {
    const ctx = audioCtxRef.current;
    if (!ctx) return;
    if (ctx.state === 'suspended') ctx.resume();

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    const now = ctx.currentTime;
    
    if (type === 'pop') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(600, now);
      osc.frequency.exponentialRampToValueAtTime(100, now + 0.2);
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
      osc.start(now);
      osc.stop(now + 0.2);
    } else if (type === 'scan') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(800, now);
      osc.frequency.linearRampToValueAtTime(1200, now + 0.05);
      gain.gain.setValueAtTime(0.03, now);
      gain.gain.linearRampToValueAtTime(0, now + 0.05);
      osc.start(now);
      osc.stop(now + 0.05);
    } else if (type === 'burn') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(50, now);
      osc.frequency.linearRampToValueAtTime(20, now + 1.0); // Extended sound for slower burn
      gain.gain.setValueAtTime(0.1, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 1.0);
      osc.start(now);
      osc.stop(now + 1.0);
    } else if (type === 'tractor') {
      // Glitchy teleport sound
      osc.type = 'square';
      osc.frequency.setValueAtTime(400, now);
      osc.frequency.linearRampToValueAtTime(1200, now + 0.1);
      osc.frequency.linearRampToValueAtTime(200, now + 0.2);
      osc.frequency.linearRampToValueAtTime(1500, now + 0.3);
      
      gain.gain.setValueAtTime(0.05, now);
      gain.gain.linearRampToValueAtTime(0.08, now + 0.1);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
      
      osc.start(now);
      osc.stop(now + 0.4);
    }
  };

  useEffect(() => {
    const newFiles = Array.from({ length: GRID_COLS * GRID_ROWS }).map((_, i) => ({
      id: `file-${i}`,
      label: POLICY_LABELS[i % POLICY_LABELS.length]
    }));
    setFiles(newFiles);
    
    return () => {
      if (audioCtxRef.current) {
        audioCtxRef.current.close();
      }
    };
  }, []);

  const animate = () => {
    const dx = mousePosRef.current.x - ufoPosRef.current.x;
    ufoPosRef.current.x += dx * UFO_EASING;
    ufoPosRef.current.y = UFO_FIXED_Y;

    if (audioCtxRef.current && engineOscRef.current && engineGainRef.current) {
        const speed = Math.abs(dx);
        const now = audioCtxRef.current.currentTime;
        const targetFreq = 150 + Math.min(speed * 4, 250);
        engineOscRef.current.frequency.setTargetAtTime(targetFreq, now, 0.1);
        const targetGain = Math.min(speed * 0.003, 0.15);
        engineGainRef.current.gain.setTargetAtTime(targetGain, now, 0.1);
    }

    const velocityTilt = Math.max(Math.min(dx * -0.4, MAX_TILT), -MAX_TILT);
    const hoverWobble = Math.sin(Date.now() / 400) * 3;
    const targetTilt = velocityTilt + hoverWobble;
    
    setTilt(prev => prev + (targetTilt - prev) * 0.1);
    setUfoPos({ ...ufoPosRef.current });

    const newHighlights = new Set<number>();
    fileRefs.current.forEach((el, index) => {
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const beamOriginY = ufoPosRef.current.y + 20;
      
      if (isPointInBeam(centerX, centerY, ufoPosRef.current.x, beamOriginY)) {
        newHighlights.add(index);
      }
    });
    
    setHighlightedFiles(prev => {
        if (newHighlights.size > prev.size) playSoundEffect('scan');
        if (prev.size !== newHighlights.size) return newHighlights;
        for (let item of newHighlights) if (!prev.has(item)) return newHighlights;
        return prev;
    });

    const now = Date.now();
    let currentTractorTarget = null;

    setParticles(prevParticles => {
      if (prevParticles.length === 0) return [];
      
      const newCollected: Particle[] = [];
      const activeParticles: Particle[] = [];

      prevParticles.forEach(p => {
        const age = now - p.spawnTime;

        // --- Incineration Logic ---
        // Incineration happens after 1000ms delay
        let nextLife = p.life;
        let nextBurnProgress = p.burnProgress;
        
        if (p.isIncinerated) {
          if (age > 1000) {
            // Start burning
            nextBurnProgress = p.burnProgress + 0.04; // Burn speed
            if (nextBurnProgress < 0.1 && p.burnProgress === 0) playSoundEffect('burn');
            // Allow progress to go beyond 1 to let smoke animation finish while card is invisible
            if (nextBurnProgress >= 1.4) nextLife = 0; 
          }
        } else {
            nextLife = p.life - 1;
        }
        
        // --- Chosen One Logic ---
        let nextX = p.x;
        let nextY = p.y;
        let nextVx = p.vx;
        let nextVy = p.vy;
        let nextRot = p.rotation;
        
        // Sequence: Fall (0-1s) -> Freeze (1-1.2s) -> Teleport/Tractor (>1.2s)
        if (p.isChosen && !p.isIncinerated) {
            if (age < 1000) {
                // Normal fall physics
                nextVy = p.vy + 0.1;
                nextX = p.x + p.vx;
                nextY = p.y + p.vy;
                nextRot = p.rotation + p.rotSpeed;
                nextVx *= 0.98;
            } else if (age < 1200) {
                // Phase 1: Charge/Anticipation
                // Float up slowly and spin intensely
                nextVx = nextVx * 0.9;
                nextVy = -1; // Float up slightly
                nextX = p.x + nextVx;
                nextY = p.y + nextVy;
                nextRot = p.rotation + 25; // High speed spin
            } else {
                // Phase 2: Teleport/Snap
                const targetX = window.innerWidth / 2;
                const targetY = window.innerHeight - 100;
                
                const dX = targetX - p.x;
                const dY = targetY - p.y;
                
                // Fast Lerp/Snap
                nextX = p.x + dX * 0.25;
                nextY = p.y + dY * 0.25;
                
                // Orient towards zero
                nextRot = p.rotation * 0.7; 
                nextVx = 0;
                nextVy = 0;

                if (Math.abs(dX) < 10 && Math.abs(dY) < 10) {
                    // ARRIVED!
                    currentTractorTarget = null;
                    newCollected.push(p);
                    return; 
                } else {
                    currentTractorTarget = { x: nextX, y: nextY };
                }
            }
        } else {
             // Normal Physics for non-chosen or incinerating
             const gravity = p.isIncinerated ? 0.05 : 0.1; 
             nextVy = p.vy + gravity;
             nextX = p.x + p.vx;
             nextY = p.y + p.vy;
             nextRot = p.rotation + p.rotSpeed;
             
             // Slow down X velocity (air resistance)
             nextVx *= 0.98;

             // CEILING COLLISION
             // Prevent particles from going above the UFO (plus some padding)
             const ceilingY = UFO_FIXED_Y + 50; 
             if (nextY < ceilingY) {
                nextY = ceilingY;
                nextVy = Math.abs(nextVy) * 0.5; // Bounce down with damping
                nextRot += (Math.random() - 0.5) * 10; // Add tumble on hit
             }
        }

        activeParticles.push({
          ...p,
          x: nextX,
          y: nextY,
          vx: nextVx,
          vy: nextVy,
          rotation: nextRot,
          life: nextLife,
          burnProgress: nextBurnProgress
        });
      });

      // Transfer to collected state if any arrived
      if (newCollected.length > 0) {
        setTimeout(() => {
            setCollectedCards(prev => {
                // Avoid duplicates just in case
                const ids = new Set(prev.map(c => c.id));
                const uniqueNew = newCollected.filter(c => !ids.has(c.id));
                return [...prev, ...uniqueNew];
            });
        }, 0);
      }

      return activeParticles.filter(p => p.life > 0 && p.y < window.innerHeight + 200);
    });

    setTractorBeamTarget(currentTractorTarget);

    requestRef.current = requestAnimationFrame(animate);
  };

  useEffect(() => {
    requestRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(requestRef.current!);
  }, []);

  const handleMouseMove = (e: React.MouseEvent) => {
    mousePosRef.current = { x: e.clientX, y: e.clientY };
    setMousePos({ x: e.clientX, y: e.clientY });
  };

  const handleInteractionStart = () => {
    initAudio();
    if (audioCtxRef.current?.state === 'suspended') {
        audioCtxRef.current.resume();
    }
  };

  const handleReset = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCollectedCards([]);
    setParticles([]);
    setSelectedPolicy(null);
    setStats({ explored: 0, filtered: 0 });
  };

  const handleFileClick = (index: number) => {
    handleInteractionStart();
    
    if (!highlightedFiles.has(index)) return;

    playSoundEffect('pop');

    const el = fileRefs.current[index];
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const label = files[index].label;

    setSelectedPolicy(null);

    // Spawn new particles
    const newParticles: Particle[] = Array.from({ length: 12 }).map((_, i) => {
        // ~66% Incineration rate
        let isIncinerated = Math.random() < 0.66;
        const isChosen = i === 0; // The first one generated will be the chosen one

        if (isChosen) isIncinerated = false; // Chosen one cannot be burned

        return {
            id: Date.now() + i + Math.random(),
            spawnTime: Date.now(),
            // Clamp start Y to avoid immediate clipping with UFO
            x: centerX + (Math.random() - 0.5) * 40,
            y: Math.max(centerY - 20, UFO_FIXED_Y + 60), 
            vx: (Math.random() - 0.5) * 35, // Wider spread (was 12)
            vy: (Math.random() * -6 - 2), // Slightly less upward force (was -10 -2)
            rotation: Math.random() * 360,
            rotSpeed: (Math.random() - 0.5) * 15,
            color: DOC_COLORS[Math.floor(Math.random() * DOC_COLORS.length)],
            life: 800,
            width: 30 + Math.random() * 10,
            height: 40 + Math.random() * 10,
            isIncinerated,
            isChosen,
            burnProgress: 0,
            data: !isIncinerated ? generatePolicyData(label) : undefined,
            read: false
        };
    });

    setParticles(prev => [...prev, ...newParticles]);
    
    // Update Stats
    const newExplored = newParticles.length;
    const newFiltered = newParticles.filter(p => !p.isIncinerated).length;
    setStats(prev => ({
        explored: prev.explored + newExplored,
        filtered: prev.filtered + newFiltered
    }));

    // Trigger tractor sound with delay: Fall(1s) + Freeze(0s) start -> Sound starts at freeze
    setTimeout(() => playSoundEffect('tractor'), 1000);
  };

  const handleCardClick = (id: number, data?: PolicyData) => {
    // Mark the card as read
    setCollectedCards(prev => prev.map(c => 
      c.id === id ? { ...c, read: true } : c
    ));

    // Open the modal
    if (data) setSelectedPolicy(data);
  };

  return (
    <div 
      className="relative w-screen h-screen overflow-hidden bg-[#0B0C15] select-none cursor-none"
      onMouseMove={handleMouseMove}
      onMouseDown={handleInteractionStart}
      onClick={handleInteractionStart}
    >
      <Stars />

      {/* Stats HUD */}
      <div className="absolute top-6 left-6 z-50 pointer-events-none select-none">
        <div className="bg-[#0f172a]/90 backdrop-blur-md border border-slate-700/50 p-5 rounded-xl shadow-2xl text-slate-300 w-64">
            <h3 className="text-[10px] uppercase tracking-[0.2em] text-slate-500 font-bold mb-4 border-b border-slate-700/50 pb-2">
                SCAN ANALYTICS
            </h3>
            
            <div className="space-y-4">
                <div className="flex justify-between items-center group">
                    <span className="text-xs font-medium text-slate-400 group-hover:text-slate-300 transition-colors">탐색한 정책</span>
                    <span className="font-mono text-lg font-bold text-white tracking-tight">{stats.explored.toLocaleString()}</span>
                </div>
                
                <div className="flex justify-between items-center group">
                    <span className="text-xs font-medium text-slate-400 group-hover:text-blue-300 transition-colors">1차 필터링</span>
                    <span className="font-mono text-lg font-bold text-blue-400 tracking-tight">{stats.filtered.toLocaleString()}</span>
                </div>

                <div className="relative pt-2 mt-2 border-t border-slate-700/50">
                    <div className="flex justify-between items-center group">
                        <span className="text-xs font-bold text-cyan-400 drop-shadow-[0_0_8px_rgba(34,211,238,0.8)]">수집된 정책</span>
                        <span className="font-mono text-2xl font-bold text-cyan-300 drop-shadow-[0_0_10px_rgba(34,211,238,0.5)]">
                            {collectedCards.length.toLocaleString()}
                        </span>
                    </div>
                    {/* Visual bar for acquired */}
                    <div className="absolute -left-5 top-2 bottom-0 w-1 bg-cyan-500 rounded-r shadow-[0_0_10px_rgba(6,182,212,0.8)]"></div>
                </div>
            </div>
        </div>
      </div>

      <div className="absolute inset-0 z-10 pt-32">
        <div className="w-full h-full flex items-center justify-center">
            <div className="grid grid-cols-5 gap-x-20 gap-y-16 max-w-6xl">
            {files.map((file, index) => (
                <div 
                key={file.id} 
                ref={el => (fileRefs.current[index] = el)}
                className="flex justify-center"
                >
                <FolderIcon 
                    highlighted={highlightedFiles.has(index)} 
                    onClick={() => handleFileClick(index)}
                    label={file.label}
                />
                </div>
            ))}
            </div>
        </div>
      </div>

      <svg className="absolute top-0 left-0 w-full h-full pointer-events-none z-20 overflow-visible">
        <defs>
          <linearGradient id="beamGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(255, 255, 220, 0.4)" />
            <stop offset="60%" stopColor="rgba(255, 255, 220, 0.1)" />
            <stop offset="100%" stopColor="rgba(255, 255, 220, 0)" />
          </linearGradient>
          <filter id="glow">
            <feGaussianBlur stdDeviation="10" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
          <filter id="tractorGlow">
            <feGaussianBlur stdDeviation="4" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
          {/* Heat Distortion Filter */}
          <filter id="heatDistortion">
            <feTurbulence type="turbulence" baseFrequency="0.05" numOctaves="2" result="turbulence">
                <animate attributeName="baseFrequency" values="0.05;0.08;0.05" dur="0.2s" repeatCount="indefinite" />
            </feTurbulence>
            <feDisplacementMap in2="turbulence" in="SourceGraphic" scale="10" xChannelSelector="R" yChannelSelector="G" />
          </filter>
          {/* Core Wobble Filter */}
          <filter id="coreWobble">
            <feTurbulence type="turbulence" baseFrequency="0.02" numOctaves="2" result="noise" seed="0">
                <animate attributeName="baseFrequency" values="0.02;0.0