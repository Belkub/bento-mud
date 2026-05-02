import { useMemo, Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Line, Sphere, PerspectiveCamera, Stars, Html } from '@react-three/drei';
import * as THREE from 'three';
import { MudInputs } from '../types';

interface TrajectoryPoint {
  x: number;
  y: number;
  z: number;
  md: number;
  radius: number; // В метрах
  color: string;
}

const SEGMENT_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316'];

/**
 * Расчет траектории скважины методом минимальной кривизны (MCM).
 */
function calculateTrajectory(intervals: MudInputs[]): TrajectoryPoint[] {
  const points: TrajectoryPoint[] = [{ x: 0, y: 0, z: 0, md: 0, radius: 0.15, color: SEGMENT_COLORS[0] }];
  
  // 1. Flatten all survey data
  const surveyData: Array<{md: number, inc: number, az: number, radius: number, color: string}> = [];
  
  const sortedIntervals = [...(intervals || [])].sort((a, b) => (Number(a.intervalStart) || 0) - (Number(b.intervalStart) || 0));

  sortedIntervals.forEach((inv, idx) => {
    const startMD = Number(inv.intervalStart) || 0;
    const endMD = Number(inv.intervalEnd) || 0;
    if (endMD <= startMD) return;

    // Определяем радиус и цвет для этого интервала
    const isLast = idx === sortedIntervals.length - 1;
    const diameterInMm = isLast ? (Number(inv.bitDiameter) || 215.9) : (Number(inv.casingInternalDiameter) || 244.5);
    const radius = (diameterInMm / 1000) / 2;
    const color = SEGMENT_COLORS[idx % SEGMENT_COLORS.length];

    // Start point
    surveyData.push({
      md: startMD,
      inc: (Number(inv.inclinationStart) || 0) * (Math.PI / 180),
      az: (Number(inv.azimuthStart) || 0) * (Math.PI / 180),
      radius,
      color
    });

    // Intermediate points
    if (inv.surveyPoints) {
      inv.surveyPoints.forEach(p => {
        const pMD = Number(p.md) || 0;
        if (pMD > startMD && pMD < endMD) {
          surveyData.push({
            md: pMD,
            inc: (Number(p.inclination) || 0) * (Math.PI / 180),
            az: (Number(p.azimuth) || 0) * (Math.PI / 180),
            radius,
            color
          });
        }
      });
    }

    // End point
    surveyData.push({
      md: endMD,
      inc: (Number(inv.inclinationEnd) || 0) * (Math.PI / 180),
      az: (Number(inv.azimuthEnd) || 0) * (Math.PI / 180),
      radius,
      color
    });
  });

  // Sort by MD
  surveyData.sort((a, b) => a.md - b.md);
  
  const uniqueSurveys: typeof surveyData = [];
  surveyData.forEach(s => {
    if (uniqueSurveys.length === 0 || s.md > uniqueSurveys[uniqueSurveys.length - 1].md) {
      uniqueSurveys.push(s);
    }
  });

  if (uniqueSurveys.length === 0) {
    points.push({ x: 0, y: -500, z: 0, md: 500, radius: 0.1, color: SEGMENT_COLORS[0] });
    return points;
  }

  let curX = 0, curY = 0, curZ = 0, curMD = 0;

  for (let i = 0; i < uniqueSurveys.length; i++) {
    const s1 = (i === 0) ? (uniqueSurveys[0].md === 0 ? uniqueSurveys[0] : { md: 0, inc: 0, az: 0, radius: uniqueSurveys[0].radius, color: uniqueSurveys[0].color }) : uniqueSurveys[i-1];
    const s2 = uniqueSurveys[i];

    if (i === 0 && s2.md > 0) {
       const gap = s2.md;
       curY -= gap;
       points.push({ x: 0, y: curY, z: 0, md: s2.md, radius: s2.radius, color: s2.color });
       curMD = s2.md;
       continue;
    }

    const dMD_total = s2.md - s1.md;
    if (dMD_total <= 0) continue;

    const i1 = s1.inc;
    const i2 = s2.inc;
    const a1 = s1.az;
    const a2 = s2.az;

    const subSteps = Math.max(2, Math.min(20, Math.ceil(dMD_total / 15))); 
    
    for (let s = 1; s <= subSteps; s++) {
      const t = s / subSteps;
      const step_dMD = dMD_total * t;
      
      const sub_i2 = i1 + (i2 - i1) * t;
      const sub_a2 = a1 + (a2 - a1) * t;

      let cosBeta = Math.cos(i1) * Math.cos(sub_i2) + Math.sin(i1) * Math.sin(sub_i2) * Math.cos(sub_a2 - a1);
      cosBeta = Math.max(-1, Math.min(1, cosBeta));
      const beta = Math.acos(cosBeta);
      
      const f = (beta > 0.0001) ? (2 / beta) * Math.tan(beta / 2) : 1;

      const dV = (step_dMD / 2) * (Math.cos(i1) + Math.cos(sub_i2)) * f;
      const dN = (step_dMD / 2) * (Math.sin(i1) * Math.cos(a1) + Math.sin(sub_i2) * Math.cos(sub_a2)) * f;
      const dE = (step_dMD / 2) * (Math.sin(i1) * Math.sin(a1) + Math.sin(sub_i2) * Math.sin(sub_a2)) * f;

      points.push({
        x: Number((curX + dE).toFixed(3)),
        y: Number((curY - dV).toFixed(3)), 
        z: Number((curZ + dN).toFixed(3)),
        md: s1.md + step_dMD,
        radius: s2.radius,
        color: s2.color
      });
    }

    const final_cosBeta = Math.cos(i1) * Math.cos(i2) + Math.sin(i1) * Math.sin(i2) * Math.cos(a2 - a1);
    const final_beta = Math.acos(Math.max(-1, Math.min(1, final_cosBeta)));
    const final_f = (final_beta > 0.0001) ? (2 / final_beta) * Math.tan(final_beta / 2) : 1;

    curX += (dMD_total / 2) * (Math.sin(i1) * Math.sin(a1) + Math.sin(i2) * Math.sin(a2)) * final_f;
    curY -= (dMD_total / 2) * (Math.cos(i1) + Math.cos(i2)) * final_f;
    curZ += (dMD_total / 2) * (Math.sin(i1) * Math.cos(a1) + Math.sin(i2) * Math.cos(a2)) * final_f;
    curMD = s2.md;
  }

  return points;
}

function WellboreScene({ points, intervals, maxDimension }: { points: TrajectoryPoint[], intervals: MudInputs[], maxDimension: number }) {
  const linePoints = useMemo(() => {
    if (!points || points.length < 2) return [new THREE.Vector3(0,0,0), new THREE.Vector3(0,-1,0)];
    return points.map(p => new THREE.Vector3(p.x, p.y, p.z));
  }, [points]);

  const maxTVD = useMemo(() => {
    let minDepth = 0;
    points.forEach(p => minDepth = Math.min(minDepth, p.y));
    return Math.abs(minDepth) || 500;
  }, [points]);

  const markerSize = maxDimension * 0.015;

  return (
    <group>
      <ambientLight intensity={1.5} />
      <pointLight position={[2000, 2000, 2000]} intensity={1} />
      <directionalLight position={[0, 1000, 0]} intensity={0.5} />
      
      <Stars radius={maxDimension * 10} depth={50} count={3000} factor={4} saturation={0} fade speed={1} />

      {/* Поверхностная сетка */}
      <gridHelper args={[maxDimension * 10, 80, 0x334155, 0x1e293b]} position={[0, 0, 0]} />

      {/* Вертикальная ось */}
      <Line
        points={[new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, -maxTVD, 0)]}
        color="#475569"
        lineWidth={1}
        dashed
        dashSize={maxDimension * 0.02}
        gapSize={maxDimension * 0.02}
      />

      {/* Ствол скважины в виде сегментов с разным диаметром */}
      {points.map((p, idx) => {
        if (idx === 0) return null;
        const prev = points[idx - 1];
        
        // Вектор сегмента
        const start = new THREE.Vector3(prev.x, prev.y, prev.z);
        const end = new THREE.Vector3(p.x, p.y, p.z);
        const direction = new THREE.Vector3().subVectors(end, start);
        const length = direction.length();
        if (length < 0.001) return null;

        // Позиция центра
        const midpoint = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);
        
        // Масштабируем радиус для достижения ЭКСТРЕМАЛЬНОГО визуального контраста.
        const baseFactor = maxDimension * 0.012; // Увеличили базовый коэффициент в 2 раза
        const relativeScale = Math.pow(p.radius / 0.08, 2.5); 
        const displayRadius = baseFactor * relativeScale;

        return (
          <mesh 
            key={`wellbore-segment-${idx}`} 
            position={midpoint}
            quaternion={new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.clone().normalize())}
          >
            <cylinderGeometry args={[displayRadius, displayRadius, length, 16]} />
            <meshStandardMaterial 
              color={p.color} 
              emissive={p.color} 
              emissiveIntensity={0.2}
              roughness={0.1}
              metalness={0.9}
            />
          </mesh>
        );
      })}

      {/* Точки интервалов и промежуточные замеры */}
      {intervals.flatMap((inv, iIdx) => {
        const pList = [];
        
        // Конец интервала
        const mdEnd = Number(inv.intervalEnd);
        if (mdEnd > 0) {
          const p = points.find(pt => pt.md >= mdEnd) || points[points.length - 1];
          if (p) pList.push({ p, md: mdEnd, isInterval: true, color: iIdx % 2 === 0 ? "#ef4444" : "#f59e0b" });
        }

        // Промежуточные замеры
        (inv.surveyPoints || []).forEach((sp, sIdx) => {
          const md = Number(sp.md);
          const p = points.find(pt => pt.md >= md) || points[points.length - 1];
          if (p) pList.push({ p, md, isInterval: false, color: "#8b5cf6" }); // Фиолетовый для замеров
        });

        return pList;
      }).map((marker, mIdx) => (
        <group key={`marker-${mIdx}`} position={[marker.p.x, marker.p.y, marker.p.z]}>
          <Sphere args={[marker.isInterval ? markerSize : markerSize * 0.6, 16, 16]}>
            <meshStandardMaterial 
              color={marker.color} 
              emissive={marker.color}
              emissiveIntensity={0.5}
            />
          </Sphere>
          <Html position={[markerSize * 2.5, 0, 0]} center>
            <div className={`bg-slate-900/80 backdrop-blur-sm px-2 py-1 rounded border border-white/10 text-white text-[9px] font-bold shadow-lg whitespace-nowrap ${!marker.isInterval ? 'opacity-70 scale-90' : ''}`}>
              {`${marker.md}м`}
            </div>
          </Html>
        </group>
      ))}

      {/* Устье скважины */}
      <group position={[0, 0, 0]}>
        <Sphere args={[markerSize * 2, 24, 24]}>
          <meshStandardMaterial color="#10b981" emissive="#10b981" emissiveIntensity={0.6} />
        </Sphere>
        <Html position={[0, markerSize * 5, 0]} center>
          <div className="text-emerald-400 font-bold text-[10px] tracking-widest uppercase bg-slate-950/80 px-3 py-1 rounded-xl border border-emerald-500/30">
            УСТЬЕ
          </div>
        </Html>
      </group>

      {/* Индикатор СЕВЕРА (N) */}
      <group>
        <Line points={[new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, maxDimension * 0.5)]} color="#ef4444" lineWidth={3} />
        <mesh position={[0, 0, maxDimension * 0.5]} rotation={[Math.PI / 2, 0, 0]}>
          <coneGeometry args={[markerSize * 1.5, markerSize * 5, 12]} />
          <meshStandardMaterial color="#ef4444" emissive="#ef4444" emissiveIntensity={0.5} />
        </mesh>
        <Html position={[0, 0, maxDimension * 0.6]} center>
          <div className="text-red-500 font-bold text-2xl drop-shadow-lg opacity-80">N</div>
        </Html>
      </group>
    </group>
  );
}

export default function TrajectoryVisualization({ intervals }: { intervals: MudInputs[] }) {
  const points = useMemo(() => calculateTrajectory(intervals), [intervals]);
  
  const bounds = useMemo(() => {
    let minX = 0, maxX = 0, minY = -500, maxY = 50, minZ = 0, maxZ = 0;
    points.forEach(p => {
      minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
      minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
      minZ = Math.min(minZ, p.z); maxZ = Math.max(maxZ, p.z);
    });
    return { minX, maxX, minY, maxY, minZ, maxZ };
  }, [points]);

  const center = useMemo(() => {
    const cx = (bounds.minX + bounds.maxX) / 2;
    const cy = (bounds.minY + bounds.maxY) / 2;
    const cz = (bounds.minZ + bounds.maxZ) / 2;
    return new THREE.Vector3(cx || 0, cy || -250, cz || 0);
  }, [bounds]);

  const maxDimension = useMemo(() => {
    const sx = bounds.maxX - bounds.minX;
    const sy = Math.abs(bounds.minY);
    const sz = bounds.maxZ - bounds.minZ;
    return Math.max(sx, sy, sz, 800);
  }, [bounds]);

  const cameraPos: [number, number, number] = [maxDimension * 1.8, maxDimension * 1.2, maxDimension * 1.8];

  return (
    <div className="w-full h-[700px] bg-[#020617] rounded-[48px] border-[10px] border-slate-900 overflow-hidden shadow-2xl relative">
      <div className="absolute top-6 left-6 z-10 pointer-events-none p-6 bg-slate-900/30 backdrop-blur-3xl rounded-[32px] border border-white/5">
        <h4 className="text-[8px] font-black text-blue-400 uppercase tracking-[0.6em] mb-1 leading-none ps-1 opacity-60">Геометрическая модель</h4>
        <p className="text-xl font-black text-white tracking-tighter uppercase italic leading-none border-b-2 border-blue-500 pb-1.5">3D Профиль</p>
      </div>

      <Canvas shadows>
        <color attach="background" args={['#020617']} />
        <PerspectiveCamera makeDefault position={cameraPos} fov={40} near={1} far={500000} />
        
        <Suspense fallback={null}>
          <WellboreScene points={points} intervals={intervals} maxDimension={maxDimension} />
          <OrbitControls 
            target={center} 
            makeDefault 
            enableDamping 
            dampingFactor={0.06}
            minDistance={100}
            maxDistance={500000}
          />
        </Suspense>
      </Canvas>

      {/* Легенда */}
      <div className="absolute bottom-10 left-10 z-10 flex flex-wrap gap-5">
        <div className="px-8 py-5 bg-slate-900/90 backdrop-blur-2xl border border-white/5 rounded-3xl flex flex-wrap gap-x-10 gap-y-4 text-[11px] font-bold text-slate-400 tracking-[0.1em] uppercase items-center max-w-[80vw]">
           <div className="flex items-center gap-3"><div className="w-4 h-4 rounded-full bg-blue-500 shadow-lg shadow-blue-500/50"></div> Интервалы (разные цвета)</div>
           <div className="flex items-center gap-3"><div className="w-4 h-4 rounded-full bg-purple-500 shadow-lg shadow-purple-500/50"></div> Замеры</div>
           <div className="flex items-center gap-3 pr-10 border-r border-slate-800"><div className="w-4 h-4 rounded-full bg-emerald-500 shadow-lg shadow-emerald-500/50"></div> Устье</div>
           <div className="flex items-center gap-5 text-slate-500">
             <div className="w-10 h-0.5 border-t-2 border-dashed border-slate-600"></div> 
             <span className="font-black">Вертикаль</span>
           </div>
        </div>
      </div>
    </div>
  );
}
