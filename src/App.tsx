/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useMemo, useEffect, ReactNode, useRef } from 'react';
import { 
  Calculator, 
  Settings, 
  Database, 
  TrendingUp, 
  ChevronRight, 
  ChevronDown, 
  Download,
  Info,
  Maximize2,
  RefreshCcw,
  XCircle,
  RotateCcw,
  FileDown
} from 'lucide-react';
import { 
  PieChart, 
  Pie, 
  Cell, 
  ResponsiveContainer, 
  Tooltip, 
  Legend, 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid 
} from 'recharts';
import { motion, AnimatePresence } from 'motion/react';
import { MudInputs, CalculationResults } from './types';
import { calculateMudParameters } from './utils/calculations';
import TrajectoryVisualization from './components/TrajectoryVisualization';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import html2canvas from 'html2canvas';
import { Document, Packer, Paragraph, Table, TableCell, TableRow, WidthType, AlignmentType, HeadingLevel, TextRun, BorderStyle, ImageRun } from 'docx';
import { saveAs } from 'file-saver';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

type InputsState = {
  [K in keyof MudInputs]: MudInputs[K] extends boolean ? boolean : 
                         K extends 'surveyPoints' ? Array<{ md: string, inclination: string, azimuth: string }> : string;
};

const InputField = ({ 
  label, 
  name, 
  unit, 
  value, 
  onChange 
}: { 
  label: string, 
  name: keyof MudInputs, 
  unit?: string, 
  value: string, 
  onChange: (name: keyof MudInputs, value: string) => void 
}) => (
  <div className="flex flex-col gap-1.5">
    <label className="text-xs font-medium text-slate-500 uppercase tracking-wider">{label}</label>
    <div className="relative">
      <input 
        type="text"
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(name, e.target.value)}
        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 font-medium focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all placeholder:text-slate-300"
      />
      {unit && <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">{unit}</span>}
    </div>
  </div>
);

const InputGroup = ({ 
  title, 
  id, 
  children, 
  expandedSection, 
  onToggle 
}: { 
  title: string, 
  id: string, 
  children: ReactNode, 
  expandedSection: string | null, 
  onToggle: (id: string) => void 
}) => (
  <div className="bg-white border border-slate-200 rounded-xl overflow-hidden mb-4 shadow-sm transition-all hover:shadow-md">
    <button 
      onClick={() => onToggle(id)}
      className="w-full px-5 py-4 flex items-center justify-between bg-slate-50 hover:bg-slate-100 transition-colors"
    >
      <span className="font-semibold text-slate-700 flex items-center gap-2">
        {id === 'geometry' && <Maximize2 size={18} className="text-blue-500" />}
        {id === 'components' && <Database size={18} className="text-amber-500" />}
        {id === 'properties' && <Settings size={18} className="text-emerald-500" />}
        {id === 'polymers' && <Info size={18} className="text-purple-500" />}
        {id === 'trajectory' && <TrendingUp size={18} className="text-red-500" />}
        {title}
      </span>
      {expandedSection === id ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
    </button>
    <AnimatePresence>
      {expandedSection === id && (
        <motion.div 
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4"
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  </div>
);

const STORAGE_KEY = 'bentomud_pro_state';

const DEFAULT_INTERVAL: InputsState = {
  prevCasingInternalDiameter: '245',
  nextCasingInternalDiameter: '178',
  bitDiameter: '215.9',
  washoutCoefficient: '1.15',
  bentoniteConcentration: '25',
  weightingAgentConcentration: '0',
  marbleConcentration: '15',
  weightingAgentDensity: '4.2',
  bentoniteColloidalContent: '85',
  rockPorosity: '20',
  cuttingContentOfSection: '10',
  dispersionMediumDensity: '1.0',
  isWeighted: false,
  filterCakeThickness: '0.8',
  intervalStart: '0',
  intervalEnd: '500',
  unweightedDensity: '1.10',
  weightedDensity: '1.15',
  cleaningStages: '4',
  mudVolumeInTanks: '150',
  prevIntervalVolume: '0',
  lpPolymerConcentration: '5',
  hpPolymerConcentration: '2',
  xcPolymerConcentration: '1',
  inclinationStart: '0',
  inclinationEnd: '0',
  azimuthStart: '0',
  azimuthEnd: '0',
  surveyPoints: []
};

export default function App() {
  const [intervals, setIntervals] = useState<InputsState[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.intervals && Array.isArray(parsed.intervals)) return parsed.intervals;
      } catch (e) { console.error(e); }
    }
    return [DEFAULT_INTERVAL];
  });

  const [activeIntervalIndex, setActiveIntervalIndex] = useState<number>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (typeof parsed.activeIntervalIndex === 'number') return parsed.activeIntervalIndex;
      } catch (e) { console.error(e); }
    }
    return 0;
  });

  const [activeTab, setActiveTab] = useState<'inputs' | 'results' | 'charts' | 'summary'>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (['inputs', 'results', 'charts', 'summary'].includes(parsed.activeTab)) return parsed.activeTab;
      } catch (e) { console.error(e); }
    }
    return 'inputs';
  });

  const [expandedSection, setExpandedSection] = useState<string | null>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return parsed.expandedSection !== undefined ? parsed.expandedSection : 'geometry';
      } catch (e) { console.error(e); }
    }
    return 'geometry';
  });

  const [hiddenRows, setHiddenRows] = useState<Set<string>>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed.hiddenRows)) return new Set(parsed.hiddenRows);
      } catch (e) { console.error(e); }
    }
    return new Set();
  });

  const trajectoryRef = useRef<HTMLDivElement>(null);
  const summaryTablesRef = useRef<HTMLDivElement>(null);
  const summaryViewRef = useRef<HTMLDivElement>(null);
  const [isDownloading, setIsDownloading] = useState(false);

  const tableConfigs = useMemo(() => [
    { 
      id: 'mud',
      title: 'Фазовый состав раствора', 
      icon: <Database size={18} className="text-blue-500" />,
      rows: (res: CalculationResults, idx: number) => [
        { id: 'cbent', label: 'Достаточная конц. бентонита (кг/м3)', value: res.cbent.toFixed(0) },
        { id: 'ccolr', label: 'Конц. коллоидной фазы (кг/м3)', value: res.ccolr.toFixed(2) },
        { id: 'ccol', label: 'Конц. коллоидной фазы (%)', value: res.ccol.toFixed(2) },
        { id: 'cshp', label: 'Конц. шлама в растворе (%)', value: res.cshp.toFixed(2) },
        { id: 'kolm', label: 'Конц. кольматанта (кг/м3)', value: res.kolm.toFixed(1) },
        { id: 'ut_kg', label: 'Конц. утяжелителя (кг/м3)', value: parseFloat(intervals[idx].weightingAgentConcentration).toFixed(2) },
        { id: 'ut_perc', label: 'Конц. утяжелителя (%)', value: res.icup.toFixed(2) },
        { id: 'octf', label: 'Общая конц. твердой фазы (%)', value: res.octf.toFixed(2), highlight: true }
      ]
    },
    { 
      id: 'vol',
      title: 'Баланс объемов раствора', 
      icon: <Maximize2 size={18} className="text-amber-500" />,
      rows: (res: CalculationResults) => [
        { id: 'korc', label: 'Толщина корки (мм)', value: res.korc.toFixed(2) },
        { id: 'vk', label: 'Объем корки (м3)', value: res.vk.toFixed(2) },
        { id: 'ff', label: 'Потери на фильтрацию (м3)', value: res.Ff.toFixed(2), color: 'text-red-500' },
        { id: 'fs', label: 'Потери на очистке (м3)', value: res.Fs.toFixed(2), color: 'text-red-500' },
        { id: 'f_tot', label: 'Общие потери (м3)', value: res.F.toFixed(2), color: 'text-red-600 font-extrabold' },
        { id: 'vkon', label: 'Объем скважины (м3)', value: res.Vkon.toFixed(2) },
        { id: 'vp', label: 'Объем приготовленного (м3)', value: res.Vp.toFixed(2), color: 'text-emerald-600' },
        { id: 'vper', label: 'К переводу на след. (м3)', value: res.Vper.toFixed(2), color: 'text-blue-600' },
        { id: 'vprev', label: 'С предыд. интервала (м3)', value: res.value_pre.toFixed(2) }
      ]
    },
    { 
      id: 'slurry',
      title: 'Фазовый состав шлама', 
      icon: <TrendingUp size={18} className="text-emerald-500" />,
      rows: (res: CalculationResults) => [
        { id: 'vsh', label: 'Объем шлама (м3)', value: res.csh_volume.toFixed(2) },
        { id: 'msh', label: 'Масса шлама (тонны)', value: res.csh_mass.toFixed(2) },
        { id: 'csh', label: 'Горная фаза в шламе (%)', value: res.Csh.toFixed(2), color: 'text-emerald-600' },
        { id: 'cr', label: 'Твердая фаза раствора (%)', value: res.Cr.toFixed(2) },
        { id: 'ctot', label: 'Общая тв. фаза в шламе (%)', value: (res.Csh + res.Cr).toFixed(2), color: 'text-slate-900 font-extrabold' },
        { id: 'cw', label: 'Водная фаза в шламе (%)', value: res.WaterSlurry.toFixed(2), color: 'text-blue-500' }
      ]
    },
    { 
      id: 'filt',
      title: 'Расчет фильтрации', 
      icon: <Settings size={18} className="text-purple-500" />,
      rows: (res: CalculationResults) => [
        { id: 'visc', label: 'Вязкость дисп. среды (мПа·с)', value: (res.viscosity * 1000).toFixed(2) },
        { id: 'find', label: 'Показатель фильтрации', value: res.filtrationIndex.toFixed(2), color: 'text-purple-600 font-extrabold' },
      ]
    }
  ], [intervals]);

  const downloadWord = async () => {
    const element = summaryViewRef.current || document.getElementById('summary-view');
    if (!element) {
      alert('Ошибка: Область отчета не найдена. Убедитесь, что вы находитесь на вкладке "Итоговая сводка".');
      return;
    }

    try {
      setIsDownloading(true);
      
      const scrollY = window.scrollY;
      window.scrollTo(0, 0);
      
      await new Promise(r => setTimeout(r, 2000));

      const docInfoParagraphs = [
          new Paragraph({
            text: "BentoMud Pro - Инженерный отчет",
            heading: HeadingLevel.HEADING_1,
            alignment: AlignmentType.CENTER,
            spacing: { after: 400 },
          }),
          new Paragraph({
            children: [
              new TextRun({ text: `Дата отчета: ${new Date().toLocaleDateString('ru-RU')}`, bold: true }),
            ],
            spacing: { after: 200 },
          }),
          new Paragraph({
            children: [
              new TextRun({ text: `Всего интервалов: ${intervals.length}`, bold: true }),
            ],
            spacing: { after: 400 },
          }),
      ];

      const doc = new Document({
        sections: [{
          properties: {
            page: {
              size: {
                orientation: 'landscape',
              },
            },
          },
          children: [
            ...docInfoParagraphs,
            ...tableConfigs.flatMap((tableConfig) => {
              const headerRow = new TableRow({
                children: [
                  new TableCell({
                    children: [new Paragraph({ children: [new TextRun({ text: "Показатель", bold: true })] })],
                    shading: { fill: "f1f5f9" },
                  }),
                  ...intervals.map((_, iIdx) => new TableCell({
                    children: [new Paragraph({ children: [new TextRun({ text: `Инт. ${iIdx + 1}`, bold: true })], alignment: AlignmentType.CENTER })],
                    shading: { fill: "f1f5f9" },
                  })),
                ],
              });

              const dataRows = tableConfig.rows(allResults[0], 0).map((rowRef, rIdx) => {
                return new TableRow({
                  children: [
                    new TableCell({
                      children: [new Paragraph({ text: rowRef.label })],
                    }),
                    ...allResults.map((res, iIdx) => {
                      const rowData = tableConfig.rows(res, iIdx)[rIdx];
                      return new TableCell({
                        children: [new Paragraph({ text: rowData.value, alignment: AlignmentType.CENTER })],
                      });
                    }),
                  ],
                });
              });

              return [
                new Paragraph({
                  text: tableConfig.title,
                  heading: HeadingLevel.HEADING_2,
                  spacing: { before: 400, after: 200 },
                }),
                new Table({
                  width: { size: 100, type: WidthType.PERCENTAGE },
                  rows: [headerRow, ...dataRows],
                }),
              ];
            }),
          ],
        }],
      });

      const blob = await Packer.toBlob(doc);
      saveAs(blob, `BentoMud_Report_${new Date().toISOString().split('T')[0]}.docx`);
      window.scrollTo(0, scrollY);
    } catch (e) {
      console.error('Word Export Error:', e);
      alert('Ошибка при сохранении Word. Попробуйте еще раз.');
    } finally {
      setIsDownloading(false);
    }
  };

  const downloadPDF = async () => {
    if (isDownloading) return;
    
    // Explicitly find the container
    const element = summaryViewRef.current || document.getElementById('summary-view');
    if (!element) {
      alert('Ошибка: Область отчета не найдена. Убедитесь, что вы находитесь на вкладке "Итоговая сводка".');
      return;
    }

    try {
      setIsDownloading(true);
      
      // Store current scroll and scroll to top for clean capture
      const scrollY = window.scrollY;
      window.scrollTo(0, 0);
      
      // Longer wait for 3D/Charts
      await new Promise(r => setTimeout(r, 2000));

      const doc = new jsPDF('p', 'mm', 'a4');
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 10;
      const contentWidth = pageWidth - (margin * 2);

      // We will capture headers, the trajectory, and then EACH table individually
      // to avoid memory issues and long single-canvas problems.
      const elementsToCapture: HTMLElement[] = [];
      
      // 1. Header
      const header = element.querySelector('.flex.flex-col.md\\:flex-row.md\\:items-end');
      if (header) elementsToCapture.push(header as HTMLElement);
      
      // 2. Trajectory
      if (trajectoryRef.current) elementsToCapture.push(trajectoryRef.current);
      
      // 3. Tables
      if (summaryTablesRef.current) {
        const tables = summaryTablesRef.current.querySelectorAll('.bg-white.border.border-slate-200');
        tables.forEach(t => elementsToCapture.push(t as HTMLElement));
      }

      // Fallback
      if (elementsToCapture.length === 0) elementsToCapture.push(element);

      let currentY = margin;

      for (let i = 0; i < elementsToCapture.length; i++) {
        const el = elementsToCapture[i];
        
        // Hide specific elements like buttons before capture
        const buttons = el.querySelectorAll('button, [data-download-btn]');
        buttons.forEach(b => (b as HTMLElement).style.opacity = '0');

        try {
          let imgData = '';
          let canvasWidth = 0;
          let canvasHeight = 0;

          // SPECIAL HANDLING FOR 3D CANVAS
          const threeCanvas = el.querySelector('canvas');
          if (threeCanvas && (el.classList.contains('h-[700px]') || el.getAttribute('data-chart-container'))) {
             try {
               imgData = threeCanvas.toDataURL('image/jpeg', 0.95);
               canvasWidth = threeCanvas.width;
               canvasHeight = threeCanvas.height;
             } catch (canvasErr) {
               console.error("Canvas toDataURL failed:", canvasErr);
             }
          }
          
          if (!imgData) {
            const canvas = await html2canvas(el, {
              scale: 2,
              useCORS: true,
              allowTaint: true,
              backgroundColor: el.classList.contains('bg-[#020617]') || el.classList.contains('bg-slate-950') ? '#020617' : '#ffffff',
              imageTimeout: 20000,
              logging: false,
            });
            imgData = canvas.toDataURL('image/jpeg', 0.95);
            canvasWidth = canvas.width;
            canvasHeight = canvas.height;
          }

          // Restore buttons
          buttons.forEach(b => (b as HTMLElement).style.opacity = '1');

          if (canvasWidth > 0 && imgData && imgData !== 'data:,') {
            const imgHeight = (canvasHeight * contentWidth) / canvasWidth;

            // Page break check
            if (currentY + imgHeight > pageHeight - margin) {
              doc.addPage();
              currentY = margin;
            }

            doc.addImage(imgData, 'JPEG', margin, currentY, contentWidth, imgHeight);
            currentY += imgHeight + 8;
          }
          
          // Small pause between sections
          await new Promise(r => setTimeout(r, 100));
        } catch (err) {
          console.error(`Section ${i} capture error:`, err);
          buttons.forEach(b => (b as HTMLElement).style.opacity = '1');
        }
      }

      doc.save(`BentoMud_Report_${new Date().toISOString().split('T')[0]}.pdf`);
      window.scrollTo(0, scrollY);
    } catch (e) {
      console.error('Master PDF Error:', e);
      alert('Ошибка при сохранении PDF. Попробуйте нажать кнопку еще раз.');
    } finally {
      setIsDownloading(false);
    }
  };

  // Persist state to localStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      intervals,
      activeIntervalIndex,
      activeTab,
      expandedSection,
      hiddenRows: Array.from(hiddenRows)
    }));
  }, [intervals, activeIntervalIndex, activeTab, expandedSection, hiddenRows]);

  const inputs = intervals[activeIntervalIndex] || intervals[0];

  const toggleRow = (id: string) => {
    setHiddenRows(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleInputChange = (name: keyof MudInputs, value: any) => {
    setIntervals(prev => {
      const next = [...prev];
      next[activeIntervalIndex] = {
        ...next[activeIntervalIndex],
        [name]: value
      };
      return next;
    });
  };

  const addInterval = () => {
    const lastInterval = intervals[intervals.length - 1];
    const lastResults = calculateMudParameters(parseSingleInputs(lastInterval));
    
    const newInterval: InputsState = {
      ...lastInterval,
      intervalStart: lastInterval.intervalEnd,
      intervalEnd: (parseFloat(lastInterval.intervalEnd) + 500).toString(),
      prevIntervalVolume: lastResults.Vper.toFixed(2),
    };
    
    setIntervals([...intervals, newInterval]);
    setActiveIntervalIndex(intervals.length);
    setActiveTab('inputs');
  };

  const removeInterval = (index: number) => {
    if (intervals.length <= 1) return;
    const nextIntervals = intervals.filter((_, i) => i !== index);
    setIntervals(nextIntervals);
    setActiveIntervalIndex(Math.max(0, index - 1));
  };

  function parseSingleInputs(input: InputsState): MudInputs {
    const result = { ...input } as any;
    for (const key in input) {
      if (key === 'surveyPoints') {
        result[key] = (input[key] as any[]).map(p => ({
          md: parseFloat(p.md.replace(',', '.')) || 0,
          inclination: parseFloat(p.inclination.replace(',', '.')) || 0,
          azimuth: parseFloat(p.azimuth.replace(',', '.')) || 0
        }));
      } else if (typeof input[key as keyof MudInputs] === 'string') {
        const val = (input[key as keyof MudInputs] as string).replace(',', '.');
        result[key] = parseFloat(val) || 0;
      }
    }
    return result as MudInputs;
  }

  const allResults = useMemo(() => {
    return intervals.map(interval => calculateMudParameters(parseSingleInputs(interval)));
  }, [intervals]);

  const results = allResults[activeIntervalIndex] || allResults[0];
  const parsedInputs = useMemo(() => parseSingleInputs(inputs), [inputs]);

  // Handle cross-interval volume synchronization
  useEffect(() => {
    setIntervals(prev => {
      let changed = false;
      const next = [...prev];
      
      for (let i = 1; i < next.length; i++) {
        const prevResults = calculateMudParameters(parseSingleInputs(next[i-1]));
        const expectedVper = prevResults.Vper.toFixed(2);
        
        if (next[i].prevIntervalVolume !== expectedVper) {
          next[i] = { ...next[i], prevIntervalVolume: expectedVper };
          changed = true;
        }
      }
      
      return changed ? next : prev;
    });
  }, [allResults]);

  // Automatic calculation of weightingAgentConcentration for active interval
  useEffect(() => {
    if (inputs.isWeighted) {
      const d = parseFloat(inputs.unweightedDensity.replace(',', '.'));
      const du = parseFloat(inputs.weightedDensity.replace(',', '.'));
      const put = parseFloat(inputs.weightingAgentDensity.replace(',', '.'));
      
      if (!isNaN(d) && !isNaN(du) && !isNaN(put) && put > du && du > d) {
        const constant_01_6 = 0.06;
        const ucu = 1000 * put * (du - d) * (1 - constant_01_6) / (put - du * (1 - constant_01_6 + constant_01_6 * put));
        const vc = 1 + (ucu * 0.001 / put);
        const icu = ucu / vc;
        
        const icuStr = icu.toFixed(2);
        if (inputs.weightingAgentConcentration !== icuStr) {
          handleInputChange('weightingAgentConcentration', icuStr);
        }
      }
    }
  }, [inputs.isWeighted, inputs.unweightedDensity, inputs.weightedDensity, inputs.weightingAgentDensity, activeIntervalIndex]);

  const mudCompositionData = useMemo(() => [
    { name: 'Коллоидяа фаза', value: Math.abs(results.ccol) },
    { name: 'Шлам', value: Math.abs(results.cshp) },
    { name: 'Кольматант', value: Math.abs(results.kolm) },
    { name: 'Утяжелитель', value: Math.abs(results.icup) },
    { name: 'Водная фаза', value: Math.abs(100 - results.octf) }
  ], [results]);

  const volumeBalanceData = [
    { name: 'Потери на фильтрацию', value: results.Ff },
    { name: 'Потери на очистке', value: results.Fs },
    { name: 'Объем скважины', value: results.Vkon },
    { name: 'Объем в емкостях', value: parsedInputs.mudVolumeInTanks }
  ];

  const slurryCompositionData = [
    { name: 'Горная порода', value: results.Csh },
    { name: 'Твердая фаза раствора', value: results.Cr },
    { name: 'Водная фаза', value: results.WaterSlurry }
  ];

  const restoreTable = (tableId: string) => {
    setHiddenRows(prev => {
      const next = new Set<string>(prev);
      const itemsToDelete = Array.from(next).filter((item: string) => item.startsWith(tableId + '_'));
      itemsToDelete.forEach(item => next.delete(item));
      return next;
    });
  };

  const restoreAll = () => setHiddenRows(new Set<string>());

  const hasHiddenRows = hiddenRows.size > 0;
  const hasHiddenInTable = (tableId: string) => Array.from(hiddenRows).some((id: string) => id.startsWith(tableId + '_'));

  const handleToggleSection = (id: string) => {
    setExpandedSection(expandedSection === id ? null : id);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40 px-6 py-4">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-blue-200">
              <Calculator size={24} strokeWidth={2.5} />
            </div>
            <div>
              <h1 className="font-bold text-xl tracking-tight leading-none">BentoMud Pro</h1>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.2em] mt-1.5">Multi-Interval Engineering System</p>
            </div>
          </div>
          
          <div className="flex flex-col gap-3">
            <nav className="flex bg-slate-100 p-1 rounded-xl self-end">
              {(['inputs', 'results', 'charts', 'summary'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-4 sm:px-6 py-2 rounded-lg text-[10px] sm:text-xs font-black uppercase tracking-wider transition-all ${
                    activeTab === tab 
                      ? 'bg-white text-blue-600 shadow-sm translate-y-[-1px]' 
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  {tab === 'inputs' ? 'Параметры' : tab === 'results' ? 'Результат' : tab === 'charts' ? 'Графики' : 'Итоговая сводка'}
                </button>
              ))}
            </nav>

            {/* Interval Selection Strip */}
            {activeTab !== 'summary' && (
              <div className="flex items-center gap-2 overflow-x-auto pb-1 max-w-full no-scrollbar self-end">
                {intervals.map((_, idx) => (
                  <div key={idx} className="flex relative group">
                    <button
                      onClick={() => setActiveIntervalIndex(idx)}
                      className={`whitespace-nowrap px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-tighter border-2 transition-all ${
                        activeIntervalIndex === idx
                          ? 'bg-slate-900 border-slate-900 text-white shadow-xl scale-105'
                          : 'bg-white border-slate-200 text-slate-500 hover:border-blue-400'
                      }`}
                    >
                      Инт. {idx + 1}
                    </button>
                    {intervals.length > 1 && (
                      <button 
                        onClick={(e) => { e.stopPropagation(); removeInterval(idx); }}
                        className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity z-10 shadow-lg"
                      >
                        <XCircle size={12} />
                      </button>
                    )}
                  </div>
                ))}
                <button
                  onClick={addInterval}
                  className="whitespace-nowrap px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-tighter border-2 border-dashed border-blue-400 text-blue-600 hover:bg-blue-50 transition-all flex items-center gap-1.5 bg-white bg-opacity-50"
                >
                  <RefreshCcw size={10} className="rotate-45" />
                  Добавить интервал?
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-6">
        <AnimatePresence mode="wait">
          {activeTab === 'summary' && (
            <motion.div
              key="summary"
              id="summary-view"
              ref={summaryViewRef}
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              className="flex flex-col gap-10 p-4"
            >
              <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b-4 border-slate-900 pb-8">
                <div>
                  <h2 className="text-5xl font-black text-slate-900 tracking-tighter uppercase mb-2">Итоговая сводка</h2>
                  <p className="text-slate-400 font-bold uppercase tracking-[0.3em] text-xs">Аналитика по всем интервалам бурения</p>
                </div>
                <div className="flex flex-wrap gap-4">
                  <button 
                    onClick={downloadWord}
                    disabled={isDownloading}
                    data-download-btn
                    className={`${isDownloading ? 'bg-slate-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 hover:scale-105 active:scale-95'} text-white px-6 py-4 rounded-2xl shadow-xl flex items-center gap-3 transition-all`}
                  >
                    {isDownloading ? (
                      <RefreshCcw size={20} className="animate-spin" />
                    ) : (
                      <Download size={20} />
                    )}
                    <span className="font-black uppercase tracking-widest text-xs">
                      {isDownloading ? 'Ждите...' : 'Word отчет'}
                    </span>
                  </button>
                  <div className="bg-slate-900 text-white p-4 rounded-2xl shadow-xl">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1 leading-none">Всего интервалов</p>
                    <p className="text-2xl font-black">{intervals.length}</p>
                  </div>
                  <div className="bg-blue-600 text-white p-4 rounded-2xl shadow-xl">
                    <p className="text-[10px] font-black uppercase tracking-widest text-blue-200 mb-1 leading-none">Общий объем приготовленного</p>
                    <p className="text-2xl font-black">{allResults.reduce((acc, r) => acc + r.Vp, 0).toFixed(1)} м³</p>
                  </div>
                </div>
              </div>

              {/* 3D Visualization */}
              <div ref={trajectoryRef}>
                <TrajectoryVisualization 
                  intervals={intervals.map(inv => parseSingleInputs(inv))} 
                />
              </div>

              {/* Summary Table Set */}
              <div className="grid grid-cols-1 gap-12" ref={summaryTablesRef}>
                {tableConfigs.map((table, tIdx) => (
                  <div key={tIdx} className="bg-white border border-slate-200 rounded-[30px] overflow-hidden shadow-sm">
                    <div className="px-8 py-6 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {table.icon}
                        <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight">{table.title}</h3>
                      </div>
                      {hasHiddenInTable(table.id) && (
                        <button onClick={() => restoreTable(table.id)} className="text-slate-400 hover:text-blue-500 transition-colors" title="Восстановить строки">
                          <RotateCcw size={18} />
                        </button>
                      )}
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse">
                        <thead>
                          <tr className="bg-slate-50/50">
                            <th className="px-8 py-4 text-left text-xs font-black uppercase tracking-widest text-slate-400 border-b border-slate-100 min-w-[250px]">Показатель</th>
                            {intervals.map((_, iIdx) => (
                              <th key={iIdx} className="px-8 py-4 text-center text-xs font-black uppercase tracking-widest text-blue-600 border-b border-slate-100 min-w-[150px]">
                                Интервал {iIdx + 1}
                                <span className="block text-[9px] text-slate-400 font-medium mt-1">{intervals[iIdx].intervalStart}-{intervals[iIdx].intervalEnd} м</span>
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 italic font-medium">
                          {table.rows(allResults[0], 0).map((rowRef, rIdx) => {
                            if (hiddenRows.has(`${table.id}_${rowRef.id}`)) return null;
                            
                            return (
                              <tr key={rIdx} className="hover:bg-slate-50/80 transition-colors group">
                                <td className="px-8 py-4 text-sm text-slate-600 font-bold group-hover:text-slate-900 transition-colors uppercase tracking-tight leading-none flex items-center gap-3">
                                  <button 
                                    onClick={() => toggleRow(`${table.id}_${rowRef.id}`)}
                                    className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-400 transition-all"
                                  >
                                    <XCircle size={14} />
                                  </button>
                                  {rowRef.label}
                                </td>
                                {allResults.map((res, iIdx) => {
                                  const row = table.rows(res, iIdx)[rIdx];
                                  return (
                                    <td key={iIdx} className="px-8 py-4 text-center text-base">
                                      <span className={`px-4 py-2 rounded-xl inline-block min-w-[80px] font-black tracking-tighter ${
                                        rIdx % 2 === 0 ? 'bg-slate-100 text-slate-700' : 'bg-blue-50 text-blue-600'
                                      }`}>
                                        {row.value}
                                      </span>
                                    </td>
                                  );
                                })}
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
          {activeTab === 'inputs' && (
            <motion.div 
              key={`inputs-${activeIntervalIndex}`}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="max-w-4xl mx-auto"
            >
              <div className="mb-8 p-6 bg-white border border-slate-200 rounded-3xl shadow-sm flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-3 mb-1">
                    <span className="px-3 py-1 bg-blue-100 text-blue-700 text-[10px] font-black uppercase rounded-full tracking-widest leading-none">Секция №{activeIntervalIndex + 1}</span>
                    <h2 className="text-2xl font-black text-slate-800 tracking-tighter uppercase italic">{intervals[activeIntervalIndex].intervalStart} — {intervals[activeIntervalIndex].intervalEnd} м</h2>
                  </div>
                  <p className="text-slate-400 text-sm font-medium">Конфигурация параметров для текущего интервала бурения</p>
                </div>
                <div className="hidden sm:flex flex-col items-end">
                  <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest mb-1 italic">Объем с пред. секции</p>
                  <div className="text-xl font-black text-slate-800 underline decoration-blue-500 decoration-4 underline-offset-4">{inputs.prevIntervalVolume} м³</div>
                </div>
              </div>

              <InputGroup title="Геометрия скважины" id="geometry" expandedSection={expandedSection} onToggle={handleToggleSection}>
                <InputField label="Внутр. диаметр пред. колонны" name="prevCasingInternalDiameter" unit="мм" value={inputs.prevCasingInternalDiameter as string} onChange={handleInputChange as any} />
                <InputField label="Внутр. диаметр след. колонны" name="nextCasingInternalDiameter" unit="мм" value={inputs.nextCasingInternalDiameter as string} onChange={handleInputChange as any} />
                <InputField label="Диаметр долота" name="bitDiameter" unit="мм" value={inputs.bitDiameter as string} onChange={handleInputChange as any} />
                <InputField label="Коэф. кавернозности" name="washoutCoefficient" unit="ед." value={inputs.washoutCoefficient as string} onChange={handleInputChange as any} />
                <InputField label="Начало интервала" name="intervalStart" unit="м" value={inputs.intervalStart as string} onChange={handleInputChange as any} />
                <InputField label="Конец интервала" name="intervalEnd" unit="м" value={inputs.intervalEnd as string} onChange={handleInputChange as any} />
              </InputGroup>

              <InputGroup title="Компоненты раствора" id="components" expandedSection={expandedSection} onToggle={handleToggleSection}>
                <InputField label="Концентрация бентонита" name="bentoniteConcentration" unit="кг/м3" value={inputs.bentoniteConcentration as string} onChange={handleInputChange as any} />
                <InputField label="Концентрация кольматанта" name="marbleConcentration" unit="кг/м3" value={inputs.marbleConcentration as string} onChange={handleInputChange as any} />
                <InputField label="Коллоидальность бентонита" name="bentoniteColloidalContent" unit="%" value={inputs.bentoniteColloidalContent as string} onChange={handleInputChange as any} />
                <div className="flex flex-col gap-1.5 pt-2">
                  <label className="text-xs font-medium text-slate-500 uppercase tracking-wider">Утяжеленный раствор?</label>
                  <button 
                    onClick={() => handleInputChange('isWeighted', !inputs.isWeighted)}
                    className={`w-full py-2.5 rounded-lg font-bold transition-all border ${
                      inputs.isWeighted 
                        ? 'bg-blue-50 border-blue-200 text-blue-600' 
                        : 'bg-slate-50 border-slate-200 text-slate-500'
                    }`}
                  >
                    {inputs.isWeighted ? 'ДА' : 'НЕТ'}
                  </button>
                </div>
                {inputs.isWeighted && (
                  <>
                    <InputField label="Концентрация утяжелителя" name="weightingAgentConcentration" unit="кг/м3" value={inputs.weightingAgentConcentration as string} onChange={handleInputChange as any} />
                    <InputField label="Плотность утяжелителя" name="weightingAgentDensity" unit="г/см3" value={inputs.weightingAgentDensity as string} onChange={handleInputChange as any} />
                    <InputField label="Плотность утяж. раствора" name="weightedDensity" unit="г/см3" value={inputs.weightedDensity as string} onChange={handleInputChange as any} />
                  </>
                )}
                <InputField label="Плотность неутяж. раствора" name="unweightedDensity" unit="г/см3" value={inputs.unweightedDensity as string} onChange={handleInputChange as any} />
                <InputField label="Плотность дисп. среды" name="dispersionMediumDensity" unit="г/см3" value={inputs.dispersionMediumDensity as string} onChange={handleInputChange as any} />
              </InputGroup>

              <InputGroup title="Свойства породы и Очистка" id="properties" expandedSection={expandedSection} onToggle={handleToggleSection}>
                <InputField label="Пористость породы" name="rockPorosity" unit="%" value={inputs.rockPorosity as string} onChange={handleInputChange as any} />
                <InputField label="Глинистость разреза" name="cuttingContentOfSection" unit="%" value={inputs.cuttingContentOfSection as string} onChange={handleInputChange as any} />
                <InputField label="Фильтрационная корка" name="filterCakeThickness" unit="мм" value={inputs.filterCakeThickness as string} onChange={handleInputChange as any} />
                <InputField label="Ступени очистки" name="cleaningStages" unit="ст." value={inputs.cleaningStages as string} onChange={handleInputChange as any} />
                <InputField label="Объем в емкостях" name="mudVolumeInTanks" unit="м3" value={inputs.mudVolumeInTanks as string} onChange={handleInputChange as any} />
                <InputField label="Объем с пред. интервала" name="prevIntervalVolume" unit="м3" value={inputs.prevIntervalVolume as string} onChange={handleInputChange as any} />
              </InputGroup>

              <InputGroup title="Концентрации полимеров" id="polymers" expandedSection={expandedSection} onToggle={handleToggleSection}>
                <InputField label="Низковязкий (PAC-LV)" name="lpPolymerConcentration" unit="кг/м3" value={inputs.lpPolymerConcentration as string} onChange={handleInputChange as any} />
                <InputField label="Высоковязкий (PAC-HV)" name="hpPolymerConcentration" unit="кг/м3" value={inputs.hpPolymerConcentration as string} onChange={handleInputChange as any} />
                <InputField label="Структурообразователь (XC)" name="xcPolymerConcentration" unit="кг/м3" value={inputs.xcPolymerConcentration as string} onChange={handleInputChange as any} />
              </InputGroup>

              <InputGroup title="Траектория (Инклинометрия)" id="trajectory" expandedSection={expandedSection} onToggle={handleToggleSection}>
                <InputField label="Зенитный угол (начало)" name="inclinationStart" unit="°" value={inputs.inclinationStart as string} onChange={handleInputChange as any} />
                <InputField label="Зенитный угол (конец)" name="inclinationEnd" unit="°" value={inputs.inclinationEnd as string} onChange={handleInputChange as any} />
                <InputField label="Азимут (начало)" name="azimuthStart" unit="°" value={inputs.azimuthStart as string} onChange={handleInputChange as any} />
                <InputField label="Азимут (конец)" name="azimuthEnd" unit="°" value={inputs.azimuthEnd as string} onChange={handleInputChange as any} />
                
                <div className="col-span-1 md:col-span-2 mt-4">
                  <div className="flex items-center justify-between mb-3 border-b border-slate-200 pb-2">
                    <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Промежуточные замеры</h4>
                    <button 
                      onClick={() => {
                        const nextPoints = [...(inputs.surveyPoints || [])];
                        // Suggest a depth in the middle of current interval if it's the first point
                        const start = parseFloat(inputs.intervalStart.replace(',', '.'));
                        const end = parseFloat(inputs.intervalEnd.replace(',', '.'));
                        const suggestMD = (start + (end - start) / 2).toString();
                        
                        nextPoints.push({ md: suggestMD, inclination: '0', azimuth: '0' });
                        // Sort by MD
                        nextPoints.sort((a, b) => parseFloat(a.md) - parseFloat(b.md));
                        handleInputChange('surveyPoints' as any, nextPoints);
                      }}
                      className="px-3 py-1 bg-slate-900 text-white text-[10px] font-black uppercase rounded-lg hover:bg-slate-800 transition-all flex items-center gap-2"
                    >
                      <RefreshCcw size={10} className="rotate-45" />
                      Добавить замер
                    </button>
                  </div>

                  <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2 no-scrollbar">
                    {(inputs.surveyPoints || []).map((point, pIdx) => (
                      <div key={pIdx} className="grid grid-cols-4 gap-2 items-end bg-white p-3 rounded-xl border border-slate-200 shadow-sm transition-all hover:border-blue-200">
                        <div className="flex flex-col gap-1">
                          <label className="text-[8px] font-black text-slate-400 uppercase tracking-tighter">Глубина (MD), м</label>
                          <input 
                            type="text" 
                            value={point.md} 
                            onChange={(e) => {
                              const nextPoints = [...(inputs.surveyPoints || [])];
                              nextPoints[pIdx] = { ...nextPoints[pIdx], md: e.target.value };
                              handleInputChange('surveyPoints' as any, nextPoints);
                            }}
                            className="w-full px-2 py-1 bg-slate-50 border border-slate-100 rounded text-xs font-bold text-slate-700 focus:ring-1 focus:ring-blue-500 outline-none"
                          />
                        </div>
                        <div className="flex flex-col gap-1">
                          <label className="text-[8px] font-black text-slate-400 uppercase tracking-tighter">Угол (Inc), °</label>
                          <input 
                            type="text" 
                            value={point.inclination} 
                            onChange={(e) => {
                              const nextPoints = [...(inputs.surveyPoints || [])];
                              nextPoints[pIdx] = { ...nextPoints[pIdx], inclination: e.target.value };
                              handleInputChange('surveyPoints' as any, nextPoints);
                            }}
                            className="w-full px-2 py-1 bg-slate-50 border border-slate-100 rounded text-xs font-bold text-slate-700 focus:ring-1 focus:ring-blue-500 outline-none"
                          />
                        </div>
                        <div className="flex flex-col gap-1">
                          <label className="text-[8px] font-black text-slate-400 uppercase tracking-tighter">Азимут (Az), °</label>
                          <input 
                            type="text" 
                            value={point.azimuth} 
                            onChange={(e) => {
                              const nextPoints = [...(inputs.surveyPoints || [])];
                              nextPoints[pIdx] = { ...nextPoints[pIdx], azimuth: e.target.value };
                              handleInputChange('surveyPoints' as any, nextPoints);
                            }}
                            className="w-full px-2 py-1 bg-slate-50 border border-slate-100 rounded text-xs font-bold text-slate-700 focus:ring-1 focus:ring-blue-500 outline-none"
                          />
                        </div>
                        <button 
                          onClick={() => {
                            const nextPoints = (inputs.surveyPoints || []).filter((_, i) => i !== pIdx);
                            handleInputChange('surveyPoints' as any, nextPoints);
                          }}
                          className="bg-red-50 text-red-500 p-1.5 rounded hover:bg-red-100 transition-colors flex items-center justify-center"
                        >
                          <XCircle size={14} />
                        </button>
                      </div>
                    ))}
                    {(inputs.surveyPoints || []).length === 0 && (
                      <div className="text-center py-6 border-2 border-dashed border-slate-100 rounded-2xl">
                        <p className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">Промежуточные точки не добавлены</p>
                      </div>
                    )}
                  </div>
                </div>
              </InputGroup>

              <div className="flex justify-center mt-10">
                <button 
                  onClick={() => setActiveTab('results')}
                  className="bg-blue-600 text-white px-12 py-4 rounded-2xl font-bold flex items-center gap-3 shadow-2xl shadow-blue-200 hover:scale-[1.02] active:scale-[0.98] transition-all"
                >
                  <TrendingUp size={20} />
                  Рассчитать параметры
                </button>
              </div>
            </motion.div>
          )}

          {activeTab === 'results' && (
            <motion.div 
              key="results"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="flex flex-col gap-6"
            >
              {/* Restore All Button */}
              {hasHiddenRows && (
                <div className="flex justify-end">
                  <button 
                    onClick={restoreAll}
                    className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-white rounded-xl text-sm font-bold shadow-lg shadow-slate-200 hover:bg-slate-700 transition-all"
                  >
                    <RefreshCcw size={16} />
                    Восстановить все строки
                  </button>
                </div>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Summary Cards */}
                <div className="lg:col-span-3 grid grid-cols-1 md:grid-cols-4 gap-4 mb-2">
                  <div className="bg-blue-600 p-6 rounded-3xl text-white shadow-xl shadow-blue-100">
                    <p className="text-blue-100 text-sm font-medium mb-1">Потери раствора</p>
                    <h3 className="text-3xl font-black">{results.F.toFixed(2)} <span className="text-lg font-normal">м3</span></h3>
                  </div>
                  <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                    <p className="text-slate-500 text-sm font-medium mb-1">Объем приготовленного</p>
                    <h3 className="text-3xl font-black text-slate-800">{results.Vp.toFixed(2)} <span className="text-lg font-normal text-slate-400">м3</span></h3>
                  </div>
                  <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                    <p className="text-slate-500 text-sm font-medium mb-1">Конц. бентонита (достат.)</p>
                    <h3 className="text-3xl font-black text-slate-800">{results.cbent.toFixed(1)} <span className="text-lg font-normal text-slate-400">кг/м3</span></h3>
                  </div>
                  <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                    <p className="text-slate-500 text-sm font-medium mb-1">Общая твердая фаза</p>
                    <h3 className="text-3xl font-black text-slate-800">{results.octf.toFixed(2)} <span className="text-lg font-normal text-slate-400">%</span></h3>
                  </div>
                </div>

                {/* Composition Table */}
                <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm lg:col-span-1">
                  <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Database size={18} className="text-blue-500" />
                      <h3 className="font-bold text-slate-800">Фазовый состав раствора</h3>
                    </div>
                    {hasHiddenInTable('mud') && (
                      <button onClick={() => restoreTable('mud')} className="text-blue-500 hover:text-blue-600 transition-colors" title="Восстановить таблицу">
                        <RotateCcw size={18} />
                      </button>
                    )}
                  </div>
                  <div className="divide-y divide-slate-100">
                    {tableConfigs[0].rows(results, activeIntervalIndex).map((row, index) => !hiddenRows.has(`mud_${row.id}`) && (
                      <div key={row.id} className={`px-6 py-3.5 flex justify-between items-center group relative ${index % 2 !== 0 ? 'bg-slate-50/50' : ''}`}>
                        <div className="flex items-center gap-3 transition-all">
                          <button 
                            onClick={() => toggleRow(`mud_${row.id}`)}
                            className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-400 transition-all"
                          >
                            <XCircle size={14} />
                          </button>
                          <span className="text-sm text-slate-600 font-medium">{row.label}</span>
                        </div>
                        <span className={`font-bold ${row.highlight ? 'text-blue-600' : ''}`}>{row.value}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Volume Balance Table */}
                <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm lg:col-span-1">
                  <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                       <Maximize2 size={18} className="text-amber-500" />
                       <h3 className="font-bold text-slate-800">Баланс объемов раствора</h3>
                    </div>
                    {hasHiddenInTable('vol') && (
                      <button onClick={() => restoreTable('vol')} className="text-amber-500 hover:text-amber-600 transition-colors" title="Восстановить таблицу">
                        <RotateCcw size={18} />
                      </button>
                    )}
                  </div>
                  <div className="divide-y divide-slate-100">
                    {tableConfigs[1].rows(results, activeIntervalIndex).map((row, index) => !hiddenRows.has(`vol_${row.id}`) && (
                      <div key={row.id} className={`px-6 py-3.5 flex justify-between items-center group relative ${index % 2 !== 0 ? 'bg-slate-50/50' : ''}`}>
                        <div className="flex items-center gap-3">
                          <button 
                            onClick={() => toggleRow(`vol_${row.id}`)}
                            className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-400 transition-all"
                          >
                            <XCircle size={14} />
                          </button>
                          <span className="text-sm text-slate-600 font-medium">{row.label}</span>
                        </div>
                        <span className={`font-bold ${row.color || ''}`}>{row.value}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Slurry Table */}
                <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm lg:col-span-1">
                  <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                       <TrendingUp size={18} className="text-emerald-500" />
                       <h3 className="font-bold text-slate-800">Фазовый состав шлама</h3>
                    </div>
                    {hasHiddenInTable('slurry') && (
                      <button onClick={() => restoreTable('slurry')} className="text-emerald-500 hover:text-emerald-600 transition-colors" title="Восстановить таблицу">
                        <RotateCcw size={18} />
                      </button>
                    )}
                  </div>
                  <div className="divide-y divide-slate-100">
                    {tableConfigs[2].rows(results, activeIntervalIndex).map((row, index) => !hiddenRows.has(`slurry_${row.id}`) && (
                      <div key={row.id} className={`px-6 py-3.5 flex justify-between items-center group relative ${index % 2 !== 0 ? 'bg-slate-50/50' : ''}`}>
                        <div className="flex items-center gap-3">
                          <button 
                            onClick={() => toggleRow(`slurry_${row.id}`)}
                            className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-400 transition-all"
                          >
                            <XCircle size={14} />
                          </button>
                          <span className="text-sm text-slate-600 font-medium">{row.label}</span>
                        </div>
                        <span className={`font-bold ${row.color || ''}`}>{row.value}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Filtration Table */}
                <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm lg:col-span-1">
                  <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                       <Settings size={18} className="text-purple-500" />
                       <h3 className="font-bold text-slate-800">Расчет фильтрации</h3>
                    </div>
                    {hasHiddenInTable('filt') && (
                      <button onClick={() => restoreTable('filt')} className="text-purple-500 hover:text-purple-600 transition-colors" title="Восстановить таблицу">
                        <RotateCcw size={18} />
                      </button>
                    )}
                  </div>
                  <div className="divide-y divide-slate-100">
                    {tableConfigs[3].rows(results, activeIntervalIndex).map((row, index) => !hiddenRows.has(`filt_${row.id}`) && (
                      <div key={row.id} className={`px-6 py-3.5 flex justify-between items-center group relative ${index % 2 !== 0 ? 'bg-slate-50/50' : ''}`}>
                        <div className="flex items-center gap-3">
                          <button 
                            onClick={() => toggleRow(`filt_${row.id}`)}
                            className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-400 transition-all"
                          >
                            <XCircle size={14} />
                          </button>
                          <span className="text-sm text-slate-600 font-medium">{row.label}</span>
                        </div>
                        <span className={`font-bold ${row.color || ''}`}>{row.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'charts' && (
            <motion.div 
              key="charts"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="grid grid-cols-1 md:grid-cols-2 gap-8"
            >
              {/* Pie Charts */}
              <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm flex flex-col items-center">
                <div className="flex items-center gap-2 mb-6">
                  <Database size={20} className="text-blue-500" />
                  <h3 className="font-black text-slate-800 text-center uppercase tracking-tighter text-lg">Фазовый состав раствора (%)</h3>
                </div>
                <div className="w-full h-[350px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={mudCompositionData}
                        cx="50%"
                        cy="50%"
                        innerRadius={70}
                        outerRadius={110}
                        paddingAngle={4}
                        dataKey="value"
                        animationBegin={0}
                        animationDuration={1200}
                      >
                        {mudCompositionData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip 
                        contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)', padding: '12px' }}
                      />
                      <Legend 
                        verticalAlign="bottom" 
                        height={40} 
                        iconType="circle"
                        formatter={(value) => <span className="text-slate-600 font-bold text-xs uppercase tracking-tight">{value}</span>}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm flex flex-col items-center">
                <div className="flex items-center gap-2 mb-6">
                  <Maximize2 size={20} className="text-amber-500" />
                  <h3 className="font-black text-slate-800 text-center uppercase tracking-tighter text-lg">Баланс объемов (%)</h3>
                </div>
                <div className="w-full h-[350px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={volumeBalanceData}
                        cx="50%"
                        cy="50%"
                        innerRadius={70}
                        outerRadius={110}
                        paddingAngle={4}
                        dataKey="value"
                        animationBegin={200}
                        animationDuration={1200}
                      >
                        {volumeBalanceData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[(index + 2) % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip 
                        contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)', padding: '12px' }}
                      />
                      <Legend 
                        verticalAlign="bottom" 
                        height={40} 
                        iconType="circle"
                        formatter={(value) => <span className="text-slate-600 font-bold text-xs uppercase tracking-tight">{value}</span>}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm flex flex-col items-center">
                <div className="flex items-center gap-2 mb-6">
                  <TrendingUp size={20} className="text-emerald-500" />
                  <h3 className="font-black text-slate-800 text-center uppercase tracking-tighter text-lg">Состав шлама (%)</h3>
                </div>
                <div className="w-full h-[350px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={slurryCompositionData}
                        cx="50%"
                        cy="50%"
                        innerRadius={70}
                        outerRadius={110}
                        paddingAngle={4}
                        dataKey="value"
                        animationBegin={400}
                        animationDuration={1200}
                      >
                        {slurryCompositionData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[(index + 4) % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip 
                        contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)', padding: '12px' }}
                      />
                      <Legend 
                        verticalAlign="bottom" 
                        height={40} 
                        iconType="circle"
                        formatter={(value) => <span className="text-slate-600 font-bold text-xs uppercase tracking-tight">{value}</span>}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Filtration Graph */}
              <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm flex flex-col items-center col-span-1 md:col-span-2">
                <div className="flex items-center gap-2 mb-8">
                  <Settings size={22} className="text-purple-500" />
                  <h3 className="font-black text-slate-800 text-center uppercase tracking-tighter text-xl">Концентрационная диаграмма фильтрации</h3>
                </div>
                <div className="w-full h-[450px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={results.chartData} margin={{ top: 10, right: 30, left: 20, bottom: 40 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis 
                        dataKey="conc" 
                        stroke="#94a3b8"
                        fontSize={11}
                        fontWeight={700}
                        tick={{ dy: 10 }}
                        label={{ 
                          value: 'Концентрация добавки (кг/м³, x0.2 для коллоида)', 
                          position: 'bottom', 
                          offset: 20,
                          fontSize: 13,
                          fontWeight: 800,
                          fill: '#64748b'
                        }}
                      />
                      <YAxis 
                        stroke="#94a3b8"
                        fontSize={11}
                        fontWeight={700}
                        label={{ 
                          value: 'Показатель фильтрации (см³/30мин)', 
                          angle: -90, 
                          position: 'insideLeft', 
                          offset: -10,
                          fontSize: 13,
                          fontWeight: 800,
                          fill: '#64748b'
                        }}
                      />
                      <Tooltip 
                        contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 25px 50px -12px rgb(0 0 0 / 0.25)', padding: '16px' }}
                        itemStyle={{ fontWeight: 700, fontSize: '13px' }}
                      />
                      <Legend 
                        verticalAlign="top" 
                        height={50}
                        iconType="line"
                        formatter={(value) => <span className="text-slate-700 font-extrabold text-xs uppercase tracking-widest px-2">{value}</span>}
                      />
                      <Line type="monotone" dataKey="LP" name="LP (PAC-LV)" stroke="#3b82f6" strokeWidth={6} dot={{ r: 6, strokeWidth: 3, fill: '#fff' }} activeDot={{ r: 8, strokeWidth: 0 }} />
                      <Line type="monotone" dataKey="HP" name="HP (PAC-HV)" stroke="#10b981" strokeWidth={6} dot={{ r: 6, strokeWidth: 3, fill: '#fff' }} activeDot={{ r: 8, strokeWidth: 0 }} />
                      <Line type="monotone" dataKey="XC" name="XC (Биополимер)" stroke="#f59e0b" strokeWidth={6} dot={{ r: 6, strokeWidth: 3, fill: '#fff' }} activeDot={{ r: 8, strokeWidth: 0 }} />
                      <Line type="monotone" dataKey="COLLOID" name="Коллоидная фаза" stroke="#8b5cf6" strokeWidth={6} strokeDasharray="10 5" dot={{ r: 6, strokeWidth: 3, fill: '#fff' }} activeDot={{ r: 8, strokeWidth: 0 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-8 p-6 bg-slate-50 rounded-3xl border border-slate-100 w-full relative overflow-hidden">
                   <div className="absolute top-0 left-0 w-1 h-full bg-purple-500/20"></div>
                   <p className="text-xs text-slate-500 leading-relaxed font-medium text-center">
                    <span className="text-purple-600 font-bold uppercase mr-2 tracking-wider">Инфо:</span> 
                    График моделирует изменение фильтрации при варьировании концентрации одного реагента при стабильности прочих. 
                    Пунктирная линия обозначает влияние коллоидной фазы (бентонита и шлама).
                   </p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Footer */}
      <footer className="max-w-7xl mx-auto px-6 py-8 border-t border-slate-200 flex flex-col md:flex-row justify-between items-center text-slate-400 text-sm gap-4">
        <div className="flex items-center gap-2">
          <Calculator size={16} />
          <span>© 2026 BentoMud Pro - Система проектирования растворов</span>
        </div>
        <div className="flex gap-6 uppercase tracking-widest font-bold text-[10px]">
          <a href="#" className="hover:text-blue-500 transition-colors">Методология</a>
          <a href="#" className="hover:text-blue-500 transition-colors">Помощь</a>
          <a href="#" className="hover:text-blue-500 transition-colors">Версия 4.0</a>
        </div>
      </footer>
    </div>
  );
}
