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

interface Laser {
  id: number;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

interface Spark {
  id: number;
  x: number;
  y: number;
}

interface HitEffect {
  id: number;
  x: number;
  y: number;
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

const Crosshair = ({ x, y, active }: { x: number, y: number, active: boolean }) => (
  <div 
    className="pointer-events-none fixed z-[100] mix-blend-difference"
    style={{ 
      left: x, 
      top: y, 
      transform: 'translate(-50%, -50%)' 
    }}
  >
    {/* Outer Ring */}
    <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 rounded-full border transition-all duration-150 ${active ? 'border-red-500 scale-125' : 'border-cyan-400 scale-100 opacity-60'}`}></div>
    {/* Cross */}
    <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-0.5 transition-colors ${active ? 'bg-red-500' : 'bg-cyan-400'}`}></div>
    <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-0.5 h-4 transition-colors ${active ? 'bg-red-500' : 'bg-cyan-400'}`}></div>
    {/* Center Dot */}
    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1 h-1 bg-red-500 rounded-full shadow-[0_0_5px_red]"></div>
  </div>
);

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

  const newImageUrl = "https://i.imgur.com/cRn5KQK.png";
  const [isLoaded, setIsLoaded] = useState(false);

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
      <img 
        src={newImageUrl} 
        alt="정책 폴더 아이콘"
        className={`w-full h-full object-contain drop-shadow-lg transition-opacity duration-300 ${isLoaded ? 'opacity-100' : 'opacity-0'}`}
        onLoad={() => setIsLoaded(true)}
        onError={(e) => {
            const target = e.target as HTMLImageElement;
            target.src = "https://placehold.co/120x100/334155/E2E8F0?text=Image+Load+Fail"; 
            setIsLoaded(true);
        }}
      />

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
        className="bg-white rounded-2xl p-6 w-[90%] max-w-md shadow-[0_0_40px_rgba(253,224,71,0.2)] border border-yellow-100 relative animate-modal opacity-0"
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
  const [lasers, setLasers] = useState<Laser[]>([]);
  const [sparks, setSparks] = useState<Spark[]>([]);
  const [hits, setHits] = useState<HitEffect[]>([]);
  
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

  const playSoundEffect = (type: 'pop' | 'scan' | 'burn' | 'tractor' | 'laser' | 'hit') => {
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
    } else if (type === 'hit') {
      // Heavier impact sound
      osc.type = 'square';
      osc.frequency.setValueAtTime(200, now);
      osc.frequency.exponentialRampToValueAtTime(50, now + 0.3);
      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
      osc.start(now);
      osc.stop(now + 0.3);
      
      // Secondary noise for explosion
      const noiseNode = ctx.createBufferSource();
      const bufferSize = ctx.sampleRate * 0.5;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      noiseNode.buffer = buffer;
      const noiseGain = ctx.createGain();
      noiseGain.gain.setValueAtTime(0.2, now);
      noiseGain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
      noiseNode.connect(noiseGain);
      noiseGain.connect(ctx.destination);
      noiseNode.start(now);

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
    } else if (type === 'laser') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(800, now);
      osc.frequency.exponentialRampToValueAtTime(100, now + 0.15);
      gain.gain.setValueAtTime(0.1, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
      osc.start(now);
      osc.stop(now + 0.15);
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
        let nextLife = p.life;
        let nextBurnProgress = p.burnProgress;
        
        if (p.isIncinerated) {
          if (age > 1000) {
            nextBurnProgress = p.burnProgress + 0.04; // Burn speed
            if (nextBurnProgress < 0.1 && p.burnProgress === 0) playSoundEffect('burn');
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
        
        // Sequence: Fall (0-1s) -> Freeze (1-1.5s) -> Teleport/Tractor (>1.5s)
        if (p.isChosen && !p.isIncinerated) {
            if (age < 1000) {
                // Normal fall physics
                nextVy = p.vy + 0.1;
                nextX = p.x + p.vx;
                nextY = p.y + p.vy;
                nextRot = p.rotation + p.rotSpeed;
                nextVx *= 0.98;
            } else if (age < 1500) {
                // Freeze phase with vibration
                nextVx = 0;
                nextVy = 0;
                nextX = p.x + (Math.random() - 0.5) * 4; // Vibrate
                nextY = p.y + (Math.random() - 0.5) * 4;
            } else {
                // Tractor Beam Phase - Moves to Bottom Center (Deck)
                const targetX = window.innerWidth / 2;
                const targetY = window.innerHeight - 100; // Destination: Bottom Center
                
                const dX = targetX - p.x;
                const dY = targetY - p.y;
                
                // Fast Lerp for snap feel
                nextX = p.x + dX * 0.2; // Speed up slightly
                nextY = p.y + dY * 0.2;
                nextRot = p.rotation * 0.8; 
                nextVx = 0;
                nextVy = 0;

                if (Math.abs(dX) < 20 && Math.abs(dY) < 20) {
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
             
             nextVx *= 0.98;
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

      if (newCollected.length > 0) {
        setTimeout(() => {
            setCollectedCards(prev => {
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

  const handleGlobalMouseDown = (e: React.MouseEvent) => {
    initAudio();
    if (audioCtxRef.current?.state === 'suspended') {
        audioCtxRef.current.resume();
    }
    
    // Fire laser from UFO current visual position
    playSoundEffect('laser');
    
    const newLaser = {
        id: Date.now(),
        x1: ufoPosRef.current.x,
        y1: ufoPosRef.current.y + 20, 
        x2: e.clientX,
        y2: e.clientY
    };
    
    setLasers(prev => [...prev, newLaser]);

    // Create Spark (Standard laser hit anywhere)
    const newSpark = {
        id: Date.now(),
        x: e.clientX,
        y: e.clientY
    };
    setSparks(prev => [...prev, newSpark]);
    
    // Auto-remove laser and spark
    setTimeout(() => {
        setLasers(prev => prev.filter(l => l.id !== newLaser.id));
    }, 150);
    setTimeout(() => {
        setSparks(prev => prev.filter(s => s.id !== newSpark.id));
    }, 300);
  };

  const handleReset = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCollectedCards([]);
    setParticles([]);
    setSelectedPolicy(null);
    setStats({ explored: 0, filtered: 0 });
  };

  const handleFileClick = (index: number) => {
    // Note: handleGlobalMouseDown fires first on mouse down, this fires on click (up)
    // We let the laser fire on mouse down, and the explosion happen on click
    
    if (!highlightedFiles.has(index)) return;

    playSoundEffect('hit'); // New hit sound

    const el = fileRefs.current[index];
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const label = files[index].label;

    setSelectedPolicy(null);

    // Create Hit Effect
    const newHit = {
      id: Date.now(),
      x: centerX,
      y: centerY
    };
    setHits(prev => [...prev, newHit]);
    setTimeout(() => setHits(prev => prev.filter(h => h.id !== newHit.id)), 300);

    const newParticles: Particle[] = Array.from({ length: 12 }).map((_, i) => {
        let isIncinerated = Math.random() < 0.66;
        const isChosen = i === 0;

        if (isChosen) isIncinerated = false;

        return {
            id: Date.now() + i + Math.random(),
            spawnTime: Date.now(),
            x: centerX + (Math.random() - 0.5) * 40,
            y: centerY - 20,
            vx: (Math.random() - 0.5) * 12, 
            vy: (Math.random() * -10 - 2), 
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
    
    setStats(prev => ({
        explored: prev.explored + newParticles.length,
        filtered: prev.filtered + newParticles.filter(p => !p.isIncinerated).length
    }));

    setTimeout(() => playSoundEffect('tractor'), 1000);
  };

  const handleCardClick = (id: number, data?: PolicyData) => {
    setCollectedCards(prev => prev.map(c => 
      c.id === id ? { ...c, read: true } : c
    ));

    if (data) setSelectedPolicy(data);
  };

  const isHoveringTarget = highlightedFiles.size > 0;

  return (
    <div 
      className="relative w-screen h-screen overflow-hidden bg-[#0B0C15] select-none cursor-none"
      onMouseMove={handleMouseMove}
      onMouseDown={handleGlobalMouseDown}
    >
      <Crosshair x={mousePos.x} y={mousePos.y} active={isHoveringTarget} />
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
          <filter id="heatDistortion">
            <feTurbulence type="turbulence" baseFrequency="0.05" numOctaves="2" result="turbulence">
                <animate attributeName="baseFrequency" values="0.05;0.08;0.05" dur="0.2s" repeatCount="indefinite" />
            </feTurbulence>
            <feDisplacementMap in2="turbulence" in="SourceGraphic" scale="10" xChannelSelector="R" yChannelSelector="G" />
          </filter>
          <filter id="coreWobble">
            <feTurbulence type="turbulence" baseFrequency="0.02" numOctaves="2" result="noise" seed="0">
                <animate attributeName="baseFrequency" values="0.02;0.06;0.02" dur="0.1s" repeatCount="indefinite"/>
            </feTurbulence>
            <feDisplacementMap in="SourceGraphic" in2="noise" scale="6" />
            <feGaussianBlur stdDeviation="1" result="glow"/>
            <feMerge>
                <feMergeNode in="glow"/>
                <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>
        
        {/* Main Beam */}
        <path
          d={`
            M ${ufoPos.x} ${ufoPos.y + 20} 
            L ${ufoPos.x - BEAM_LENGTH * BEAM_SPREAD} ${ufoPos.y + BEAM_LENGTH} 
            L ${ufoPos.x + BEAM_LENGTH * BEAM_SPREAD} ${ufoPos.y + BEAM_LENGTH} 
            Z
          `}
          fill="url(#beamGradient)"
          style={{ mixBlendMode: 'plus-lighter' }}
          filter="url(#glow)"
        />
        
        {/* Lasers */}
        {lasers.map(laser => (
            <line
                key={laser.id}
                x1={laser.x1}
                y1={laser.y1}
                x2={laser.x2}
                y2={laser.y2}
                stroke="cyan"
                strokeWidth="4"
                strokeLinecap="round"
                className="opacity-80"
                filter="url(#glow)"
            />
        ))}

        {/* Tractor Beam Visuals */}
        {tractorBeamTarget && (
            <g filter="url(#tractorGlow)">
                {/* Outer pulsing aura - Erratic */}
                <line
                    x1={ufoPos.x}
                    y1={ufoPos.y + 20}
                    x2={tractorBeamTarget.x}
                    y2={tractorBeamTarget.y}
                    stroke="cyan"
                    strokeWidth="20"
                    strokeOpacity="0.4"
                    strokeLinecap="round"
                >
                    <animate attributeName="stroke-opacity" values="0.2;0.8;0.3;0.9;0.2;0.7" dur="0.08s" repeatCount="indefinite" />
                    <animate attributeName="stroke-width" values="20;55;25;45;15;50" dur="0.09s" repeatCount="indefinite" />
                    <animate attributeName="stroke" values="#00ffff;#0099ff;#00ffff;#80ffff" dur="0.1s" repeatCount="indefinite" />
                </line>

                {/* Moving energy dashes */}
                <line
                    x1={ufoPos.x}
                    y1={ufoPos.y + 20}
                    x2={tractorBeamTarget.x}
                    y2={tractorBeamTarget.y}
                    stroke="#e0f2fe"
                    strokeWidth="8"
                    strokeDasharray="10 30"
                    strokeLinecap="round"
                >
                    <animate attributeName="stroke-dashoffset" from="40" to="0" dur="0.05s" repeatCount="indefinite" />
                </line>

                {/* Inner white core - Wobbly */}
                <line
                    x1={ufoPos.x}
                    y1={ufoPos.y + 20}
                    x2={tractorBeamTarget.x}
                    y2={tractorBeamTarget.y}
                    stroke="white"
                    strokeWidth="6"
                    strokeOpacity="1"
                    filter="url(#coreWobble)"
                >
                     <animate attributeName="stroke-width" values="5;8;5" dur="0.08s" repeatCount="indefinite" />
                </line>
            </g>
        )}
      </svg>
      
      {/* Laser Sparks (Small Hit) */}
      {sparks.map(s => (
        <div 
            key={s.id} 
            className="laser-spark"
            style={{ left: s.x, top: s.y }}
        />
      ))}

      {/* Explosion Blasts (Target Hit) */}
      {hits.map(h => (
          <div key={h.id} className="hit-blast" style={{ left: h.x, top: h.y }}>
             <div className="hit-ring"></div>
          </div>
      ))}
      
      {/* Particles (Falling & Active) */}
      {particles.map(p => {
        const age = Date.now() - p.spawnTime;
        const isBurning = p.isIncinerated && age > 1000;
        
        const visualBurnProgress = Math.min(p.burnProgress, 1);
        const burnScale = 1 - visualBurnProgress * 0.5;
        const burnBrightness = 1 - visualBurnProgress * 0.8;
        const burnHue = visualBurnProgress * 50; 
        
        const isTractorPhase = p.isChosen && age > 1500;
        const isFreezePhase = p.isChosen && age > 1000 && age <= 1500;

        let dynamicOpacity = 1 - visualBurnProgress;
        if (isTractorPhase) {
            // Fade out as it moves to center (approx 350ms duration)
            const fadeProgress = (age - 1500) / 350;
            dynamicOpacity = Math.max(0, 1 - fadeProgress);
        }

        return (
            <div
            key={p.id}
            className={`absolute transition-transform duration-75
                ${p.isIncinerated ? 'pointer-events-none' : 'pointer-events-none'}
                ${isTractorPhase || isFreezePhase ? 'z-[60]' : 'z-30'}
            `}
            style={{
                left: p.x,
                top: p.y,
                transform: `translate(-50%, -50%) rotate(${p.rotation}deg) scale(${isTractorPhase ? 1.2 : burnScale})`,
                width: `${p.width}px`,
                height: `${p.height}px`,
            }}
            >
                {/* Visual Card Container - Fades out independently when burning */}
                <div 
                    className={`absolute inset-0 shadow-md flex flex-col items-center justify-center
                        ${isTractorPhase || isFreezePhase ? 'shadow-[0_0_30px_rgba(0,255,255,0.6)]' : ''}
                    `}
                    style={{
                        borderRadius: '4px',
                        backgroundColor: isBurning ? '#333' : '#FFF',
                        border: isBurning ? 'none' : ((isTractorPhase || isFreezePhase) ? '2px solid cyan' : '1px solid #E5E7EB'),
                        filter: isBurning 
                            ? `brightness(${burnBrightness}) sepia(1) hue-rotate(-${burnHue}deg) url(#heatDistortion)` 
                            : 'none',
                        opacity: dynamicOpacity,
                        boxShadow: isBurning ? '0 0 20px 10px rgba(255, 69, 0, 0.4)' : 'none'
                    }}
                >
                    <div className="w-full h-2 absolute top-0 left-0" style={{ backgroundColor: p.color }}></div>
                    
                    {!p.isIncinerated && (
                        <div className="absolute -top-3 -left-3 w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center border-2 border-white shadow-sm z-10">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="20 6 9 17 4 12"></polyline>
                            </svg>
                        </div>
                    )}

                    <div className="flex flex-col gap-1 w-full px-1 mt-1">
                        <div className="w-2/3 h-1 bg-gray-200 rounded-sm"></div>
                        <div className="w-full h-1 bg-gray-100 rounded-sm"></div>
                        <div className="w-full h-1 bg-gray-100 rounded-sm"></div>
                    </div>

                    {isBurning && (
                        <div className="absolute inset-0 bg-orange-500 mix-blend-overlay opacity-50 rounded-sm"></div>
                    )}
                </div>
                
                {isBurning && (
                    <>
                        {Array.from({length: 5}).map((_, i) => {
                            const r1 = pseudoRandom(p.id + i * 11);
                            const r2 = pseudoRandom(p.id + i * 22);
                            const type = r2 > 0.6 ? 'smoke-particle-right' : (r2 > 0.3 ? 'smoke-particle-left' : 'smoke-particle');
                            return (
                                <div 
                                    key={`smoke-${i}`}
                                    className={`${type}`}
                                    style={{ 
                                        width: `${1.5 + r1 * 1.5}rem`,
                                        height: `${1.5 + r1 * 1.5}rem`,
                                        top: `${(r2 * 20) - 20}%`,
                                        left: `${(r1 * 120) - 10}%`,
                                        animationDelay: `${i * 0.15}s`
                                    }} 
                                />
                            );
                        })}
                        
                        {Array.from({length: 7}).map((_, i) => {
                            const r1 = pseudoRandom(p.id + i * 33);
                            const r2 = pseudoRandom(p.id + i * 44);
                            const wobble = r2 > 0.5;
                            return (
                                <div 
                                    key={`ember-${i}`}
                                    className={wobble ? "ember-particle-wobble" : "ember-particle"}
                                    style={{ 
                                        bottom: `${(r1 * 50)}%`,
                                        left: `${(r2 * 100)}%`,
                                        animationDelay: `${i * 0.1}s`,
                                        animationDuration: `${0.8 + r1 * 0.5}s`
                                    }} 
                                />
                            );
                        })}
                    </>
                )}
            </div>
        );
      })}

      {/* Collected Cards Display (Bottom Center) */}
      <div className="absolute bottom-10 left-1/2 transform -translate-x-1/2 flex items-end justify-center z-40 h-32 w-full pointer-events-none">
          {collectedCards.map((card, index) => {
              const total = collectedCards.length;
              // Fan out calculation
              const rotation = (index - (total - 1) / 2) * 5;
              const yOffset = Math.abs(index - (total - 1) / 2) * 8; // Increased arc slightly
              const xOffset = (index - (total - 1) / 2) * 35; // Increased spacing slightly
              
              const isRead = !!card.read;

              return (
                <div
                    key={card.id}
                    onClick={(e) => {
                        e.stopPropagation();
                        handleCardClick(card.id, card.data);
                    }}
                    className={`absolute bottom-0 cursor-pointer pointer-events-auto transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] hover:scale-110 hover:z-50 hover:-translate-y-4`}
                    style={{
                        width: '130px',
                        height: '170px',
                        transform: `translateX(${xOffset}px) rotate(${rotation}deg) translateY(${yOffset}px)`,
                        zIndex: index
                    }}
                >
                    {/* Inner Wrapper for Entry Animation */}
                    <div 
                        className="w-full h-full animate-card-spring relative flex flex-col bg-white rounded-lg shadow-xl overflow-hidden"
                        // No delay on sequential adds usually, but helps if batch
                        style={{ animationDelay: `${index * 0.05}s` }} 
                    >
                        {/* Header Color - Removed bottom gradient line */}
                        <div className="h-6 w-full shrink-0 relative" style={{ backgroundColor: card.color }}></div>

                        {/* Body */}
                        <div className="p-3 flex-1 flex flex-col bg-gradient-to-b from-white to-gray-50">
                             {/* Mini Skeleton UI */}
                             <div className="flex gap-2 mb-2">
                                <div className="w-8 h-8 rounded bg-gray-100 flex items-center justify-center shrink-0">
                                     <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={card.color} strokeWidth="2">
                                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                                        <polyline points="14 2 14 8 20 8"></polyline>
                                     </svg>
                                </div>
                                <div className="flex flex-col gap-1 w-full pt-1">
                                    <div className="w-full h-1.5 bg-gray-200 rounded-full"></div>
                                    <div className="w-2/3 h-1.5 bg-gray-200 rounded-full"></div>
                                </div>
                             </div>
                             
                             <div className="mt-auto">
                                <div className="text-[11px] font-bold text-gray-800 leading-tight line-clamp-2">
                                    {card.data?.name}
                                </div>
                                <div className="text-[9px] text-gray-500 mt-1">
                                    {card.data?.amount}
                                </div>
                             </div>
                        </div>

                        {/* Badge */}
                        {!isRead && (
                             <div className="absolute top-2 right-2 translate-x-1/2 -translate-y-1/2 w-6 h-6 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center shadow-lg animate-bounce z-20 border-2 border-white">
                                !
                             </div>
                        )}
                    </div>
                </div>
              )
          })}
      </div>

      {/* Reset Button */}
      {collectedCards.length > 0 && (
        <button
            onClick={handleReset}
            className="absolute bottom-8 right-8 z-[100] px-6 py-2 bg-red-500/80 hover:bg-red-600 text-white font-bold rounded-full backdrop-blur-sm shadow-[0_0_15px_rgba(239,68,68,0.5)] transition-all animate-in fade-in cursor-pointer pointer-events-auto"
        >
            Reset
        </button>
      )}

      {/* UFO */}
      <div 
        className="absolute top-0 left-0 z-50 pointer-events-none"
        style={{
          transform: `translate(${ufoPos.x}px, ${ufoPos.y}px)`
        }}
      >
        <UFO tilt={tilt} />
      </div>
      
      {/* Modal Overlay */}
      {selectedPolicy && (
          <PolicyModal data={selectedPolicy} onClose={() => setSelectedPolicy(null)} />
      )}

      {/* Hints */}
      <div className="absolute bottom-5 right-5 text-gray-500 text-xs opacity-50 pointer-events-none">
        Click folders to find policies • Unsuitable policies are incinerated
      </div>

    </div>
  );
};

const root = createRoot(document.getElementById('root')!);
root.render(<App />);