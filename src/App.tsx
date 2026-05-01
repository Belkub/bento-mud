/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useMemo, useEffect, ReactNode } from 'react';
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
  RotateCcw
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

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

type InputsState = {
  [K in keyof MudInputs]: MudInputs[K] extends boolean ? boolean : string;
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

export default function App() {
  const [inputs, setInputs] = useState<InputsState>({
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
    xcPolymerConcentration: '1'
  });

  const [activeTab, setActiveTab] = useState<'inputs' | 'results' | 'charts'>('inputs');
  const [expandedSection, setExpandedSection] = useState<string | null>('geometry');
  const [hiddenRows, setHiddenRows] = useState<Set<string>>(new Set());

  const toggleRow = (id: string) => {
    setHiddenRows(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

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

  const handleInputChange = (name: keyof MudInputs, value: string | boolean) => {
    setInputs(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const parsedInputs = useMemo(() => {
    const result = { ...inputs } as any;
    for (const key in inputs) {
      if (typeof inputs[key as keyof MudInputs] === 'string') {
        // Replace comma with dot for parsing
        const val = (inputs[key as keyof MudInputs] as string).replace(',', '.');
        result[key] = parseFloat(val) || 0;
      }
    }
    return result as MudInputs;
  }, [inputs]);

  const results = useMemo(() => calculateMudParameters(parsedInputs), [parsedInputs]);

  // Automatic calculation of weightingAgentConcentration
  useEffect(() => {
    if (inputs.isWeighted) {
      const d = parseFloat(inputs.unweightedDensity.replace(',', '.'));
      const du = parseFloat(inputs.weightedDensity.replace(',', '.'));
      const put = parseFloat(inputs.weightingAgentDensity.replace(',', '.'));
      
      if (!isNaN(d) && !isNaN(du) && !isNaN(put) && put > du && du > d) {
        const constant_01_6 = 0.06;
        // ucu is addition per 1 m3 of base mud
        const ucu = 1000 * put * (du - d) * (1 - constant_01_6) / (put - du * (1 - constant_01_6 + constant_01_6 * put));
        // vc is resulting volume from 1 m3 base
        const vc = 1 + (ucu * 0.001 / put);
        // icu is concentration in the final volume (kg/m3)
        const icu = ucu / vc;
        
        const icuStr = icu.toFixed(2);
        if (inputs.weightingAgentConcentration !== icuStr) {
          setInputs(prev => ({
            ...prev,
            weightingAgentConcentration: icuStr
          }));
        }
      }
    }
  }, [inputs.isWeighted, inputs.unweightedDensity, inputs.weightedDensity, inputs.weightingAgentDensity]);

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

  const handleToggleSection = (id: string) => {
    setExpandedSection(expandedSection === id ? null : id);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-blue-200">
            <Calculator size={24} strokeWidth={2.5} />
          </div>
          <div>
            <h1 className="font-bold text-xl tracking-tight">BentoMud</h1>
            <p className="text-xs text-slate-500 font-medium uppercase tracking-widest">Проектирование бурового раствора</p>
          </div>
        </div>
        
        <nav className="flex bg-slate-100 p-1 rounded-xl">
          {(['inputs', 'results', 'charts'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-6 py-2 rounded-lg text-sm font-bold capitalize transition-all ${
                activeTab === tab 
                  ? 'bg-white text-blue-600 shadow-sm' 
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {tab === 'inputs' ? 'Ввод данных' : tab === 'results' ? 'Результаты' : 'Диаграммы'}
            </button>
          ))}
        </nav>

        <button className="flex items-center gap-2 bg-slate-900 text-white px-5 py-2.5 rounded-xl font-bold text-sm shadow-xl shadow-slate-200 hover:bg-slate-800 transition-all">
          <Download size={18} />
          Экспорт PDF
        </button>
      </header>

      <main className="max-w-7xl mx-auto p-6">
        <AnimatePresence mode="wait">
          {activeTab === 'inputs' && (
            <motion.div 
              key="inputs"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="max-w-4xl mx-auto"
            >
              <div className="mb-6">
                <h2 className="text-2xl font-bold text-slate-800">Параметры скважины и раствора</h2>
                <p className="text-slate-500">Введите технологические параметры для расчета оптимального состава</p>
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
                    {[
                      { id: 'cbent', label: 'Достаточная конц. бентонита (кг/м3)', value: results.cbent.toFixed(0) },
                      { id: 'ccolr', label: 'Конц. коллоидной фазы (кг/м3)', value: results.ccolr.toFixed(2) },
                      { id: 'ccol', label: 'Конц. коллоидной фазы (%)', value: results.ccol.toFixed(2) },
                      { id: 'cshp', label: 'Конц. шлама в растворе (%)', value: results.cshp.toFixed(2) },
                      { id: 'kolm', label: 'Конц. кольматанта (кг/м3)', value: results.kolm.toFixed(1) },
                      { id: 'ut_kg', label: 'Конц. утяжелителя (кг/м3)', value: parseFloat(inputs.weightingAgentConcentration).toFixed(2) },
                      { id: 'ut_perc', label: 'Конц. утяжелителя (%)', value: results.icup.toFixed(2) },
                      { id: 'octf', label: 'Общая конц. твердой фазы (%)', value: results.octf.toFixed(2), highlight: true }
                    ].map((row, index) => !hiddenRows.has(`mud_${row.id}`) && (
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
                    {[
                      { id: 'korc', label: 'Толщина корки (мм)', value: results.korc.toFixed(2) },
                      { id: 'vk', label: 'Объем корки (м3)', value: results.vk.toFixed(2) },
                      { id: 'ff', label: 'Потери на фильтрацию (м3)', value: results.Ff.toFixed(2), color: 'text-red-500' },
                      { id: 'fs', label: 'Потери на очистке (м3)', value: results.Fs.toFixed(2), color: 'text-red-500' },
                      { id: 'f_tot', label: 'Общие потери (м3)', value: results.F.toFixed(2), color: 'text-red-600 font-extrabold' },
                      { id: 'vkon', label: 'Объем скважины (м3)', value: results.Vkon.toFixed(2) },
                      { id: 'vp', label: 'Объем приготовленного (м3)', value: results.Vp.toFixed(2), color: 'text-emerald-600' },
                      { id: 'vper', label: 'К переводу на след. (м3)', value: results.Vper.toFixed(2), color: 'text-blue-600' },
                      { id: 'vprev', label: 'С предыд. интервала (м3)', value: results.value_pre.toFixed(2) }
                    ].map((row, index) => !hiddenRows.has(`vol_${row.id}`) && (
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
                    {[
                      { id: 'vsh', label: 'Объем шлама (м3)', value: results.csh_volume.toFixed(2) },
                      { id: 'msh', label: 'Масса шлама (тонны)', value: results.csh_mass.toFixed(2) },
                      { id: 'csh', label: 'Горная фаза в шламе (%)', value: results.Csh.toFixed(2), color: 'text-emerald-600' },
                      { id: 'cr', label: 'Твердая фаза раствора (%)', value: results.Cr.toFixed(2) },
                      { id: 'ctot', label: 'Общая тв. фаза в шламе (%)', value: (results.Csh + results.Cr).toFixed(2), color: 'text-slate-900 font-extrabold' },
                      { id: 'cw', label: 'Водная фаза в шламе (%)', value: results.WaterSlurry.toFixed(2), color: 'text-blue-500' }
                    ].map((row, index) => !hiddenRows.has(`slurry_${row.id}`) && (
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
                    {[
                      { id: 'visc', label: 'Вязкость дисп. среды (мПа·с)', value: (results.viscosity * 1000).toFixed(2) },
                      { id: 'find', label: 'Показатель фильтрации', value: results.filtrationIndex.toFixed(2), color: 'text-purple-600 font-extrabold' },
                    ].map((row, index) => !hiddenRows.has(`filt_${row.id}`) && (
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
                      <Line type="monotone" dataKey="LP" name="LP (PAC-LV)" stroke="#3b82f6" strokeWidth={4} dot={{ r: 4, strokeWidth: 2, fill: '#fff' }} activeDot={{ r: 6, strokeWidth: 0 }} />
                      <Line type="monotone" dataKey="HP" name="HP (PAC-HV)" stroke="#10b981" strokeWidth={4} dot={{ r: 4, strokeWidth: 2, fill: '#fff' }} activeDot={{ r: 6, strokeWidth: 0 }} />
                      <Line type="monotone" dataKey="XC" name="XC (Биополимер)" stroke="#f59e0b" strokeWidth={4} dot={{ r: 4, strokeWidth: 2, fill: '#fff' }} activeDot={{ r: 6, strokeWidth: 0 }} />
                      <Line type="monotone" dataKey="COLLOID" name="Коллоидная фаза" stroke="#8b5cf6" strokeWidth={4} strokeDasharray="8 4" dot={{ r: 4, strokeWidth: 2, fill: '#fff' }} activeDot={{ r: 6, strokeWidth: 0 }} />
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
