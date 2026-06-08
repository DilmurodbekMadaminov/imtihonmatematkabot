/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { 
  CheckCircle2, 
  XCircle, 
  ChevronRight, 
  RotateCcw, 
  BrainCircuit, 
  BarChart3, 
  Target, 
  Activity, 
  Search, 
  ChevronLeft, 
  BookOpen, 
  GraduationCap, 
  Calculator, 
  FileText,
  Clock,
  MapPin,
  Flame,
  Shield
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { variants } from './questions';
import { mathSections } from './mathSections';
import { milliySertifikat } from './milliySertifikat';
import { Question } from './types';
import AdminPanel from './components/AdminPanel';

function QuizApp() {
  const [activeTab, setActiveTab] = useState<'majburiy' | 'matematika' | 'milliy' | 'admin'>('majburiy');
  const [selectedVariant, setSelectedVariant] = useState<number | null>(null);
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null);
  const [selectedSectionVariantIndex, setSelectedSectionVariantIndex] = useState<number | null>(null);
  const [started, setStarted] = useState(false);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<number[]>([]);
  const [finished, setFinished] = useState(false);

  // Search and Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDateChip, setSelectedDateChip] = useState('Barchasi');

  const dateChips = ['Barchasi', '14-iyul', '15-iyul', '16-iyul', '17-iyul', '18-iyul', '19-iyul', '20-iyul', '21-iyul'];

  const handleStartMajburiy = (variantIndex: number) => {
    setSelectedVariant(variantIndex);
    setSelectedSectionId(null);
    setSelectedSectionVariantIndex(null);
    setStarted(true);
    setCurrentQuestion(0);
    setAnswers([]);
    setFinished(false);
  };

  const handleStartIxtisoslik = (sectionId: string, variantIndex: number) => {
    setSelectedSectionId(sectionId);
    setSelectedSectionVariantIndex(variantIndex);
    setSelectedVariant(null);
    setStarted(true);
    setCurrentQuestion(0);
    setAnswers([]);
    setFinished(false);
  };

  const handleStartMilliy = (variantIndex: number) => {
    setSelectedVariant(variantIndex);
    setSelectedSectionId(null);
    setSelectedSectionVariantIndex(null);
    setStarted(true);
    setCurrentQuestion(0);
    setAnswers([]);
    setFinished(false);
  };

  const handleBackToMenu = () => {
    setSelectedVariant(null);
    setSelectedSectionId(null);
    setSelectedSectionVariantIndex(null);
    setStarted(false);
    setFinished(false);
  };

  const currentQuestions = useMemo<Question[]>(() => {
    if (!started) return [];
    if (activeTab === 'majburiy' && selectedVariant !== null) {
      return variants[selectedVariant]?.questions || [];
    }
    if (activeTab === 'milliy' && selectedVariant !== null) {
      return milliySertifikat[selectedVariant]?.questions || [];
    }
    if (activeTab === 'matematika' && selectedSectionId !== null && selectedSectionVariantIndex !== null) {
      const section = mathSections.find(s => s.id === selectedSectionId);
      return section?.variants[selectedSectionVariantIndex]?.questions || [];
    }
    return [];
  }, [started, activeTab, selectedVariant, selectedSectionId, selectedSectionVariantIndex]);

  const currentTitle = useMemo<string>(() => {
    if (activeTab === 'majburiy' && selectedVariant !== null) {
      return variants[selectedVariant]?.title || '';
    }
    if (activeTab === 'milliy' && selectedVariant !== null) {
      return milliySertifikat[selectedVariant]?.title || '';
    }
    if (activeTab === 'matematika' && selectedSectionId !== null && selectedSectionVariantIndex !== null) {
      const section = mathSections.find(s => s.id === selectedSectionId);
      return `${section?.title} - ${section?.variants[selectedSectionVariantIndex]?.title}`;
    }
    return '';
  }, [activeTab, selectedVariant, selectedSectionId, selectedSectionVariantIndex]);

  const handleAnswer = (optionIndex: number) => {
    const newAnswers = [...answers, optionIndex];
    setAnswers(newAnswers);
    
    if (currentQuestion < currentQuestions.length - 1) {
      setCurrentQuestion(currentQuestion + 1);
    } else {
      setFinished(true);
    }
  };

  const results = useMemo(() => {
    if (!finished || currentQuestions.length === 0) return null;
    
    const isCorrect = answers.map((ans, i) => ans === currentQuestions[i].correct);
    const rawScore = isCorrect.filter(Boolean).length;
    const percentage = Math.round((rawScore / currentQuestions.length) * 100);
    
    return {
      isCorrect,
      rawScore,
      percentage
    };
  }, [answers, finished, currentQuestions]);

  // Filtering Majburiy variants based on date chips and search bar
  const filteredMajburiyVariants = useMemo(() => {
    return variants.map((v, index) => ({ ...v, originalIndex: index })).filter(v => {
      const matchesSearch = v.title.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesDate = selectedDateChip === 'Barchasi' || v.title.toLowerCase().includes(selectedDateChip.toLowerCase());
      return matchesSearch && matchesDate;
    });
  }, [searchQuery, selectedDateChip]);

  if (!started) {
    return (
      <div className="min-h-screen bg-slate-50 py-10 px-4 sm:px-6 lg:px-8 font-sans">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="text-center mb-10">
            <motion.div 
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.5 }}
              className="bg-indigo-600 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-indigo-200"
            >
              <BrainCircuit size={32} className="text-white" />
            </motion.div>
            <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
              Matematika Imtihon Platformasi
            </h1>
            <p className="mt-3 text-lg text-slate-600 max-w-2xl mx-auto">
              Bilimingizni sinab ko'ring. Majburiy fanlar va ixtisoslik bo'limlari bo'yicha saralangan Milliy Sertifikat savollari.
            </p>
          </div>

          {/* Navigation Tabs */}
          <div className="flex flex-col sm:flex-row gap-2 border-b border-slate-200 mb-8 bg-white p-2 rounded-xl shadow-sm">
            <button
              onClick={() => { setActiveTab('majburiy'); setSelectedSectionId(null); }}
              className={`flex-1 py-3 text-center font-semibold text-sm rounded-lg transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer ${
                activeTab === 'majburiy'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <BookOpen size={18} />
              Majburiy <span className="bg-slate-200 text-slate-800 text-xs px-2 py-0.5 rounded-full font-bold ml-1 active-mode-badge border border-white">370 ta test</span>
            </button>
            <button
              onClick={() => { setActiveTab('matematika'); setSelectedSectionId(null); }}
              className={`flex-1 py-3 text-center font-semibold text-sm rounded-lg transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer ${
                activeTab === 'matematika'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <Calculator size={18} />
              Ixtisoslik bo'limlari
            </button>
            <button
              onClick={() => { setActiveTab('milliy'); setSelectedSectionId(null); }}
              className={`flex-1 py-3 text-center font-semibold text-sm rounded-lg transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer ${
                activeTab === 'milliy'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <GraduationCap size={18} />
              Milliy Sertifikat <span className="bg-slate-200 text-slate-800 text-xs px-2 py-0.5 rounded-full font-bold ml-1 active-mode-badge border border-white">6 ta imtihon</span>
            </button>
            <button
              onClick={() => { setActiveTab('admin'); setSelectedSectionId(null); }}
              className={`flex-1 py-3 text-center font-semibold text-sm rounded-lg transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer ${
                activeTab === 'admin'
                  ? 'bg-slate-900 text-white shadow-md font-bold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50 opacity-95'
              }`}
            >
              <Shield size={18} />
              Admin Panel
            </button>
          </div>

          <AnimatePresence mode="wait">
            {activeTab === 'majburiy' && (
              <motion.div
                key="majburiy"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.3 }}
                className="space-y-6"
              >
                {/* Search and Filters */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 space-y-4">
                  <div className="relative">
                    <Search className="absolute left-4 top-3.5 text-slate-400" size={20} />
                    <input
                      type="text"
                      placeholder="Variantlardan qidiring (Masalan: 1-smena, 14-iyul...)"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-12 pr-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all text-slate-800 bg-slate-50"
                    />
                  </div>

                  {/* Date chips */}
                  <div className="flex flex-wrap gap-2 pt-1 border-t border-slate-100">
                    {dateChips.map(chip => (
                      <button
                        key={chip}
                        onClick={() => setSelectedDateChip(chip)}
                        className={`text-xs px-3 py-1.5 rounded-full font-medium transition-all duration-150 cursor-pointer ${
                          selectedDateChip === chip
                            ? 'bg-slate-900 text-white'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        {chip}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Grid of Variants */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  {filteredMajburiyVariants.length > 0 ? (
                    filteredMajburiyVariants.map((v) => (
                      <motion.div
                        key={v.originalIndex}
                        whileHover={{ y: -2, transition: { duration: 0.15 } }}
                        className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 flex flex-col justify-between"
                      >
                        <div>
                          <div className="flex items-center gap-2 text-indigo-600 font-bold text-xs uppercase tracking-wider mb-2">
                            <span className="w-1.5 h-1.5 bg-indigo-600 rounded-full animate-pulse"></span>
                            Imtihon Savoli
                          </div>
                          <h3 className="font-bold text-slate-800 text-md line-clamp-2 mb-4 h-12">
                            {v.title}
                          </h3>
                        </div>
                        <div className="flex items-center justify-between border-t border-slate-100 pt-3 mt-2">
                          <span className="text-xs text-slate-500 flex items-center gap-1">
                            <FileText size={14} /> 10 ta Savol
                          </span>
                          <button
                            onClick={() => handleStartMajburiy(v.originalIndex)}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold py-2 px-4 rounded-lg transition-colors flex items-center justify-center gap-1 cursor-pointer"
                          >
                            Boshlash <ChevronRight size={14} />
                          </button>
                        </div>
                      </motion.div>
                    ))
                  ) : (
                    <div className="col-span-full py-12 text-center bg-white rounded-2xl border border-slate-200">
                      <p className="text-slate-500 font-medium">Bunday nomdagi variant topilmadi.</p>
                      <button 
                        onClick={() => { setSearchQuery(''); setSelectedDateChip('Barchasi'); }}
                        className="mt-3 text-indigo-600 hover:text-indigo-800 font-semibold text-xs underlying-link cursor-pointer"
                      >
                        Filtrlarni bekor qilish
                      </button>
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {activeTab === 'matematika' && (
              <motion.div
                key="matematika"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.3 }}
                className="space-y-6"
              >
                {!selectedSectionId ? (
                  /* Section list */
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {mathSections.map((section) => (
                      <motion.div
                        key={section.id}
                        whileHover={{ scale: 1.01, transition: { duration: 0.15 } }}
                        className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm flex flex-col justify-between"
                      >
                        <div className="p-6">
                          <div className="flex items-center justify-between mb-4">
                            <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
                              <GraduationCap size={24} />
                            </div>
                            <span className="text-xs bg-slate-100 text-slate-600 font-bold px-3 py-1 rounded-full border border-slate-200">
                              {section.variants.length} ta variant
                            </span>
                          </div>
                          <h3 className="font-extrabold text-slate-800 text-lg mb-2">
                            {section.title}
                          </h3>
                          <p className="text-slate-600 text-sm leading-relaxed mb-4">
                            {section.description}
                          </p>
                        </div>
                        <div className="bg-slate-50 px-6 py-4 border-t border-slate-100 flex items-center justify-between">
                          <span className="text-xs text-slate-500 font-medium">Ixtisoslik darajasi</span>
                          <button
                            onClick={() => setSelectedSectionId(section.id)}
                            className="text-indigo-600 hover:text-indigo-800 text-xs font-bold flex items-center gap-1 cursor-pointer"
                          >
                            Bo'limni ko'rish <ChevronRight size={14} />
                          </button>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                ) : (
                  /* Section details: Variants */
                  <div className="space-y-6">
                    <div className="flex items-center gap-4">
                      <button
                        onClick={() => setSelectedSectionId(null)}
                        className="p-2 bg-white hover:bg-slate-100 text-slate-600 hover:text-slate-900 border border-slate-200 rounded-xl transition-all cursor-pointer flex items-center"
                      >
                        <ChevronLeft size={20} />
                      </button>
                      <div>
                        <h2 className="text-xl font-extrabold text-slate-800">
                          {mathSections.find(s => s.id === selectedSectionId)?.title} bo'limi
                        </h2>
                        <p className="text-xs text-slate-500">Mavzulashtirilgan ixtisoslashtirilgan testlar</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {mathSections.find(s => s.id === selectedSectionId)?.variants.map((v, i) => (
                        <div key={i} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
                          <div>
                            <div className="flex items-center gap-1.5 text-indigo-600 font-bold text-xs uppercase tracking-wider mb-2">
                              <Flame size={12} className="text-indigo-600" /> Topic-Level
                            </div>
                            <h3 className="font-bold text-slate-800 text-md mb-4 leading-snug">
                              {v.title}
                            </h3>
                          </div>
                          <div className="flex items-center justify-between border-t border-slate-100 pt-3 mt-4">
                            <span className="text-xs text-slate-500">
                              {v.questions.length} ta savol
                            </span>
                            <button
                              onClick={() => handleStartIxtisoslik(selectedSectionId, i)}
                              className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold py-2 px-4 rounded-lg transition-colors cursor-pointer"
                            >
                              Ishlash
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </motion.div>
            )}

            {activeTab === 'milliy' && (
              <motion.div
                key="milliy"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.3 }}
                className="space-y-6"
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  {milliySertifikat.map((v, i) => (
                    <motion.div
                      key={i}
                      whileHover={{ y: -2, transition: { duration: 0.15 } }}
                      className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-center gap-2 text-indigo-600 font-bold text-xs uppercase tracking-wider mb-2">
                          <span className="w-1.5 h-1.5 bg-indigo-600 rounded-full animate-pulse"></span>
                          DTM / Bilim Baholash imtihoni
                        </div>
                        <h3 className="font-bold text-slate-850 text-md mb-4 h-12 leading-snug">
                          {v.title}
                        </h3>
                      </div>
                      <div className="flex items-center justify-between border-t border-slate-100 pt-3 mt-2">
                        <span className="text-xs text-slate-500 flex items-center gap-1">
                          <FileText size={14} /> {v.questions.length} ta Savol
                        </span>
                        <button
                          onClick={() => handleStartMilliy(i)}
                          className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold py-2 px-4 rounded-lg transition-colors flex items-center justify-center gap-1 cursor-pointer"
                        >
                          Boshlash <ChevronRight size={14} />
                        </button>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            )}

            {activeTab === 'admin' && (
              <motion.div
                key="admin"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.3 }}
              >
                <AdminPanel />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    );
  }

  if (finished && results) {
    return (
      <div className="min-h-screen bg-slate-50 py-10 px-4 sm:px-6 lg:px-8 font-sans">
        <div className="max-w-3xl mx-auto space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center shadow-md">
            <span className="bg-indigo-50 text-indigo-600 border border-indigo-100 rounded-full px-4 py-1 text-xs font-bold tracking-wider uppercase mb-4 inline-block">
              {currentTitle}
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-800 mb-6">Sizning Natijangiz</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
              <div className="bg-slate-50 rounded-xl p-6 border border-slate-100">
                <Target className="mx-auto mb-2 text-indigo-600" size={32} />
                <div className="text-sm text-slate-500 font-semibold mb-1">To'g'ri Javoblar</div>
                <div className="text-3xl font-extrabold text-slate-800">{results.rawScore} / {currentQuestions.length}</div>
              </div>
              
              <div className="bg-emerald-50 rounded-xl p-6 border border-emerald-100">
                <BarChart3 className="mx-auto mb-2 text-emerald-600" size={32} />
                <div className="text-sm text-emerald-600 font-semibold mb-1">Foiz ko'rsatkichi</div>
                <div className="text-3xl font-extrabold text-emerald-700">{results.percentage}%</div>
              </div>
            </div>

            <button 
              onClick={handleBackToMenu}
              className="bg-slate-900 hover:bg-slate-850 text-white font-medium py-3 px-8 rounded-xl transition-all inline-flex items-center gap-2 cursor-pointer shadow-md"
            >
              <RotateCcw size={18} /> Bosh sahifaga qaytish
            </button>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="bg-slate-50 px-6 py-4 border-b border-slate-200">
              <h3 className="font-bold text-slate-800">Savollar tahlili va yechimlar</h3>
            </div>
            <div className="divide-y divide-slate-100">
              {currentQuestions.map((q, i) => {
                const isCorrect = results.isCorrect[i];
                
                return (
                  <div key={q.id} className="p-6 hover:bg-slate-50 transition-colors">
                    <div className="flex gap-4">
                      <div className="mt-1 flex-shrink-0">
                        {isCorrect ? (
                          <CheckCircle2 className="text-emerald-500" size={24} />
                        ) : (
                          <XCircle className="text-red-500" size={24} />
                        )}
                      </div>
                      <div className="flex-1">
                        {q.imageUrl && (
                          <div className="mb-3">
                            <img src={q.imageUrl} alt="Savol rasmi" className="max-w-full h-auto max-h-40 rounded-lg shadow-sm" />
                          </div>
                        )}
                        <div className="font-bold text-slate-800 mb-3">{i + 1}. {q.text}</div>
                        
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-4">
                          {q.options.map((opt, optIdx) => {
                            let itemClass = "px-4 py-3 rounded-xl text-sm border font-medium ";
                            if (optIdx === q.correct) {
                              itemClass += "bg-emerald-50 border-emerald-200 text-emerald-800";
                            } else if (optIdx === answers[i]) {
                              itemClass += "bg-red-50 border-red-200 text-red-800";
                            } else {
                              itemClass += "bg-white border-slate-200 text-slate-600";
                            }
                            
                            return (
                              <div key={optIdx} className={itemClass}>
                                <span className="font-bold mr-1.5">{String.fromCharCode(65 + optIdx)})</span> {opt}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    );
  }

  const q = currentQuestions[currentQuestion];

  if (!q) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="text-center p-8 bg-white border border-slate-200 rounded-2xl w-full max-w-sm">
          <p className="text-slate-600">Savollar tahlili yuklanmadi yoki xatolik yuz berdi.</p>
          <button 
            onClick={handleBackToMenu}
            className="mt-4 bg-indigo-600 text-white font-semibold py-2 px-6 rounded-lg w-full cursor-pointer"
          >
            Orqaga qaytish
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 font-sans">
      <div className="max-w-2xl w-full">
        {/* Quiz Navigator Header */}
        <div className="mb-4 flex items-center justify-between">
          <button
            onClick={handleBackToMenu}
            className="text-xs font-bold text-slate-500 hover:text-slate-800 flex items-center gap-1 bg-white hover:bg-slate-100 border border-slate-200 px-3 py-1.5 rounded-lg transition-all cursor-pointer"
          >
            <ChevronLeft size={14} /> Chiqish
          </button>
          <div className="text-sm font-bold text-indigo-600 uppercase tracking-wider">
            {currentTitle}
          </div>
        </div>

        <div className="mb-4 flex items-center justify-between">
          <div className="text-xs font-bold text-slate-500 uppercase">
            Savol {currentQuestion + 1} / {currentQuestions.length}
          </div>
          <div className="text-xs font-semibold text-slate-400">
            Javob berildi: {currentQuestion} tasi
          </div>
        </div>
        
        {/* Progress Bar */}
        <div className="w-full bg-slate-200 h-2 rounded-full mb-6 overflow-hidden">
          <div 
            className="bg-indigo-600 h-full transition-all duration-300 ease-out"
            style={{ width: `${((currentQuestion) / currentQuestions.length) * 100}%` }}
          ></div>
        </div>

        {/* Question Card */}
        <motion.div 
          key={currentQuestion}
          initial={{ opacity: 0, x: 10 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -10 }}
          transition={{ duration: 0.2 }}
          className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 mb-6"
        >
          {q.imageUrl && (
            <div className="mb-6 flex justify-center">
              <img src={q.imageUrl} alt="Savol rasmi" className="max-w-full h-auto max-h-64 rounded-lg shadow-sm" />
            </div>
          )}
          <h2 className="text-xl font-bold text-slate-800 mb-8 leading-relaxed">
            {q.text}
          </h2>
          
          <div className="space-y-3">
            {q.options.map((opt, i) => (
              <button
                key={i}
                onClick={() => handleAnswer(i)}
                className="w-full text-left px-6 py-4 rounded-xl border-2 border-slate-100 hover:border-indigo-600 hover:bg-indigo-50 transition-all font-semibold text-slate-700 hover:text-indigo-950 flex items-center gap-4 group cursor-pointer"
              >
                <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-slate-100 text-slate-500 group-hover:bg-indigo-600 group-hover:text-white transition-colors font-bold">
                  {String.fromCharCode(65 + i)}
                </span>
                {opt}
              </button>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<QuizApp />} />
      </Routes>
    </Router>
  );
}
