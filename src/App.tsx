/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect } from 'react';
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
  Flame,
  Shield,
  Printer,
  Award,
  Layers,
  Sparkles
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { variants } from './questions';
import { mathSections } from './mathSections';
import { milliySertifikat } from './milliySertifikat';
import { yoshKitobxon } from './yoshKitobxon';
import { Question } from './types';
import AdminPanel from './components/AdminPanel';

function QuizApp() {
  const [activeTab, setActiveTab] = useState<'majburiy' | 'matematika' | 'milliy' | 'yosh_kitobxon' | 'custom' | 'admin'>('yosh_kitobxon');
  const [selectedVariant, setSelectedVariant] = useState<number | null>(null);
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null);
  const [selectedSectionVariantIndex, setSelectedSectionVariantIndex] = useState<number | null>(null);
  const [selectedCustomTestId, setSelectedCustomTestId] = useState<string | null>(null);
  
  const [started, setStarted] = useState(false);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<number[]>([]);
  const [finished, setFinished] = useState(false);

  // Countdown timer for each question (60 seconds)
  const [timeLeft, setTimeLeft] = useState<number>(60);

  // Search and Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDateChip, setSelectedDateChip] = useState('Barchasi');

  // Telegram/Platform Integrations User States
  const [userId, setUserId] = useState<number>(12345);
  const [userName, setUserName] = useState<string>('Mehmon');
  const [userReferrals, setUserReferrals] = useState<number>(0);
  const [customTests, setCustomTests] = useState<any[]>([]);
  const [userResults, setUserResults] = useState<any[]>([]);
  const [loadingData, setLoadingData] = useState<boolean>(true);
  const [botUsername, setBotUsername] = useState<string>('kitobtanlovbot');
  const [isAdmin, setIsAdmin] = useState<boolean>(false);

  // Certificate Modal States
  const [showCertificate, setShowCertificate] = useState(false);
  const [certName, setCertName] = useState('');
  const [certPercentage, setCertPercentage] = useState(0);
  const [certTestTitle, setCertTestTitle] = useState('');
  const [certTestId, setCertTestId] = useState('');

  const dateChips = ['Barchasi', '14-iyul', '15-iyul', '16-iyul', '17-iyul', '18-iyul', '19-iyul', '20-iyul', '21-iyul'];

  // Initialize Telegram User & Fetch database states
  useEffect(() => {
    const tg = (window as any).Telegram?.WebApp;
    let uId = 12345;
    let uName = 'Sinaluvchi Mehmon';

    if (tg && tg.initDataUnsafe && tg.initDataUnsafe.user) {
      uId = tg.initDataUnsafe.user.id;
      uName = tg.initDataUnsafe.user.first_name || 'Foydalanuvchi';
    } else {
      const savedMockId = localStorage.getItem('mock_user_id');
      if (savedMockId) {
        uId = Number(savedMockId);
      } else {
        uId = Math.floor(100000 + Math.random() * 900000);
        localStorage.setItem('mock_user_id', uId.toString());
      }
      uName = localStorage.getItem('mock_user_name') || 'Sinaluvchi Mehmon';
    }

    setUserId(uId);
    setUserName(uName);
    setCertName(uName);

    // Load custom tests and results from Backend
    fetch(`/api/web-app/user-data?userId=${uId}`)
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setUserReferrals(data.user?.referralsCount || 0);
          setCustomTests(data.customTests || []);
          setUserResults(data.results || []);
          setIsAdmin(uId === 7858117466);
          if (data.botUsername) {
            setBotUsername(data.botUsername);
          }
        }
      })
      .catch(err => console.error("Error loading web-app data:", err))
      .finally(() => setLoadingData(false));
  }, []);

  // Real-time non-blocking background referral validation check
  useEffect(() => {
    if (!userId || userId === 12345) return;

    const checkReferrals = () => {
      fetch(`/api/web-app/referrals?userId=${userId}`)
        .then(res => res.json())
        .then(data => {
          if (data.success) {
            if (data.referralsCount !== undefined) {
              setUserReferrals(data.referralsCount);
            }
            setIsAdmin(userId === 7858117466);
          }
        })
        .catch(err => console.warn("Silent background referral check failed:", err));
    };

    // Run verification check every 10 seconds
    const interval = setInterval(checkReferrals, 10000);
    return () => clearInterval(interval);
  }, [userId]);

  // Post test score results to Backend database
  const submitResult = async (percentage: number, testIdStr: string, titleStr: string) => {
    try {
      await fetch("/api/web-app/submit-result", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          testId: testIdStr,
          testTitle: titleStr,
          percentage
        })
      });
      // Refresh historical scores of the user
      const response = await fetch(`/api/web-app/user-data?userId=${userId}`);
      const data = await response.json();
      if (data.success) {
        setUserResults(data.results || []);
      }
    } catch (e) {
      console.error("Failed to submit result:", e);
    }
  };

  // Automated 60-seconds per-question timer count down
  useEffect(() => {
    if (!started || finished) return;

    setTimeLeft(60);

    const interval = setInterval(() => {
      setTimeLeft(p => {
        if (p <= 1) {
          clearInterval(interval);
          // Auto answer as wrong (-1 value signifying timeout)
          handleAnswer(-1);
          return 60;
        }
        return p - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [currentQuestion, started, finished]);

  const handleStartMajburiy = (variantIndex: number) => {
    setSelectedVariant(variantIndex);
    setSelectedSectionId(null);
    setSelectedSectionVariantIndex(null);
    setSelectedCustomTestId(null);
    setStarted(true);
    setCurrentQuestion(0);
    setAnswers([]);
    setFinished(false);
  };

  const handleStartIxtisoslik = (sectionId: string, variantIndex: number) => {
    setSelectedSectionId(sectionId);
    setSelectedSectionVariantIndex(variantIndex);
    setSelectedVariant(null);
    setSelectedCustomTestId(null);
    setStarted(true);
    setCurrentQuestion(0);
    setAnswers([]);
    setFinished(false);
  };

  const handleStartMilliy = (variantIndex: number) => {
    setSelectedVariant(variantIndex);
    setSelectedSectionId(null);
    setSelectedSectionVariantIndex(null);
    setSelectedCustomTestId(null);
    setStarted(true);
    setCurrentQuestion(0);
    setAnswers([]);
    setFinished(false);
  };

  const handleStartYoshKitobxon = (variantIndex: number) => {
    setSelectedVariant(variantIndex);
    setSelectedSectionId(null);
    setSelectedSectionVariantIndex(null);
    setSelectedCustomTestId(null);
    setStarted(true);
    setCurrentQuestion(0);
    setAnswers([]);
    setFinished(false);
  };

  const handleBackToMenu = () => {
    setSelectedVariant(null);
    setSelectedSectionId(null);
    setSelectedSectionVariantIndex(null);
    setSelectedCustomTestId(null);
    setStarted(false);
    setFinished(false);
  };

  const currentQuestions = useMemo<Question[]>(() => {
    if (!started) return [];
    if (selectedCustomTestId !== null) {
      return customTests.find(t => t.id === selectedCustomTestId)?.questions || [];
    }
    if (activeTab === 'majburiy' && selectedVariant !== null) {
      return variants[selectedVariant]?.questions || [];
    }
    if (activeTab === 'milliy' && selectedVariant !== null) {
      return milliySertifikat[selectedVariant]?.questions || [];
    }
    if (activeTab === 'yosh_kitobxon' && selectedVariant !== null) {
      return yoshKitobxon[selectedVariant]?.questions || [];
    }
    if (activeTab === 'matematika' && selectedSectionId !== null && selectedSectionVariantIndex !== null) {
      const section = mathSections.find(s => s.id === selectedSectionId);
      return section?.variants[selectedSectionVariantIndex]?.questions || [];
    }
    return [];
  }, [started, activeTab, selectedVariant, selectedSectionId, selectedSectionVariantIndex, selectedCustomTestId, customTests]);

  const currentTitle = useMemo<string>(() => {
    if (selectedCustomTestId !== null) {
      return customTests.find(t => t.id === selectedCustomTestId)?.title || 'Vaqtli Test';
    }
    if (activeTab === 'majburiy' && selectedVariant !== null) {
      return variants[selectedVariant]?.title || '';
    }
    if (activeTab === 'milliy' && selectedVariant !== null) {
      return milliySertifikat[selectedVariant]?.title || '';
    }
    if (activeTab === 'yosh_kitobxon' && selectedVariant !== null) {
      return yoshKitobxon[selectedVariant]?.title || '';
    }
    if (activeTab === 'matematika' && selectedSectionId !== null && selectedSectionVariantIndex !== null) {
      const section = mathSections.find(s => s.id === selectedSectionId);
      return `${section?.title} - ${section?.variants[selectedSectionVariantIndex]?.title}`;
    }
    return '';
  }, [activeTab, selectedVariant, selectedSectionId, selectedSectionVariantIndex, selectedCustomTestId, customTests]);

  const handleAnswer = (optionIndex: number) => {
    const newAnswers = [...answers, optionIndex];
    setAnswers(newAnswers);
    
    if (currentQuestion < currentQuestions.length - 1) {
      setCurrentQuestion(currentQuestion + 1);
    } else {
      setFinished(true);
      // Analyze percentage score and initiate logging
      const isCorrect = newAnswers.map((ans, i) => ans === currentQuestions[i].correct);
      const rawScore = isCorrect.filter(Boolean).length;
      const percentage = Math.round((rawScore / currentQuestions.length) * 100);
      const testIdStr = selectedCustomTestId ? selectedCustomTestId : (selectedVariant !== null ? `variant_${selectedVariant}` : `math_${selectedSectionId}_${selectedSectionVariantIndex}`);
      submitResult(percentage, testIdStr, currentTitle);
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

  const filteredMajburiyVariants = useMemo(() => {
    return variants.map((v, index) => ({ ...v, originalIndex: index })).filter(v => {
      const matchesSearch = v.title.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesDate = selectedDateChip === 'Barchasi' || v.title.toLowerCase().includes(selectedDateChip.toLowerCase());
      return matchesSearch && matchesDate;
    });
  }, [searchQuery, selectedDateChip]);

  // Handle invitation link copying
  const mockReferralLink = `https://t.me/${botUsername}?start=ref_${userId}`;

  // If loading user credentials
  if (loadingData) {
    return (
      <div className="min-h-screen bg-slate-55 flex flex-col items-center justify-center font-sans">
        <BrainCircuit size={48} className="text-indigo-600 animate-spin mb-4" />
        <h3 className="text-slate-800 font-bold block text-sm">Matematika yuklanmoqda...</h3>
      </div>
    );
  }

  // Required referrals matches the dynamic quantity of added custom tests
  const requiredReferrals = 1 + customTests.length;

  // NORMAL FULL-ACCESS EXAMS MENU
  if (!started) {
    return (
      <div className="min-h-screen bg-slate-50 py-4 px-3 sm:px-6 lg:px-8 font-sans">
        <div className="max-w-4xl mx-auto">

          {/* Compact Navigation Tabs for Tests */}
          <div className="grid grid-cols-2 md:flex md:flex-wrap gap-1.5 border-b border-slate-200 mb-5 bg-white p-1.5 rounded-xl shadow-xs">
            <button
              onClick={() => { setActiveTab('majburiy'); setSelectedSectionId(null); }}
              className={`py-2 px-3 text-center font-bold text-xs rounded-lg transition-all duration-200 flex items-center justify-center gap-1.5 cursor-pointer ${
                activeTab === 'majburiy'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <BookOpen size={14} />
              Majburiy <span className="bg-slate-200 text-slate-800 text-[9px] px-1.5 py-0.2 rounded-full font-bold border border-white">370 ta test</span>
            </button>
            <button
              onClick={() => { setActiveTab('matematika'); setSelectedSectionId(null); }}
              className={`py-2 px-3 text-center font-bold text-xs rounded-lg transition-all duration-200 flex items-center justify-center gap-1.5 cursor-pointer ${
                activeTab === 'matematika'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <Calculator size={14} />
              Ixtisoslik
            </button>
            <button
              onClick={() => { setActiveTab('milliy'); setSelectedSectionId(null); }}
              className={`py-2 px-3 text-center font-bold text-xs rounded-lg transition-all duration-200 flex items-center justify-center gap-1.5 cursor-pointer ${
                activeTab === 'milliy'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <GraduationCap size={14} />
              Milliy Sertifikat <span className="bg-slate-200 text-slate-800 text-[9px] px-1.5 py-0.2 rounded-full font-bold border border-white">6 ta imtihon</span>
            </button>

            <button
              onClick={() => { setActiveTab('yosh_kitobxon'); setSelectedSectionId(null); setSelectedVariant(null); }}
              className={`py-2 px-3 text-center font-bold text-xs rounded-lg transition-all duration-200 flex items-center justify-center gap-1.5 cursor-pointer ${
                activeTab === 'yosh_kitobxon'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <Sparkles size={14} className="text-amber-500" />
              Yosh kitobxon <span className="bg-amber-100 text-amber-800 text-[9px] px-1.5 py-0.2 rounded-full font-bold border border-white">30 ta test</span>
            </button>
            
            {customTests.length > 0 && (
              <button
                onClick={() => { setActiveTab('custom'); setSelectedSectionId(null); }}
                className={`py-2 px-3 text-center font-bold text-xs rounded-lg transition-all duration-200 flex items-center justify-center gap-1.5 cursor-pointer ${
                  activeTab === 'custom'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                <Clock size={14} className="animate-pulse text-rose-500" />
                Vaqtli Imtihonlar
              </button>
            )}

            {isAdmin && (
              <button
                onClick={() => { setActiveTab('admin'); setSelectedSectionId(null); }}
                className={`col-span-2 py-2 px-3 text-center font-bold text-xs rounded-lg transition-all duration-200 flex items-center justify-center gap-1.5 cursor-pointer ${
                  activeTab === 'admin'
                    ? 'bg-slate-950 text-white shadow-md'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50 bg-slate-50'
                }`}
              >
                <Shield size={14} />
                Admin Panel
              </button>
            )}
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
                          <p className="text-slate-600 text-xs leading-relaxed mb-4">
                            {section.description}
                          </p>
                        </div>
                        <div className="bg-slate-50 px-6 py-4 border-t border-slate-100 flex items-center justify-between">
                          <span className="text-xs text-slate-500 font-medium font-bold">Ixtisoslik darajasi</span>
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
                              <Flame size={12} className="text-indigo-650" /> Topic-Level
                            </div>
                            <h3 className="font-bold text-slate-800 text-sm mb-4 leading-snug">
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
                          DTM imtihoni
                        </div>
                        <h3 className="font-bold text-slate-850 text-sm mb-4 h-12 leading-snug">
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

            {activeTab === 'yosh_kitobxon' && (
              <motion.div
                key="yosh_kitobxon"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.3 }}
                className="space-y-6"
              >
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div>
                    <h3 className="font-extrabold text-slate-800 text-sm flex items-center gap-2">
                      <Sparkles size={16} className="text-amber-500 animate-pulse" /> Yosh kitobxon bo'limi
                    </h3>
                    <p className="text-xs text-slate-500 mt-1">
                      Badiiy asarlar, hikoyalar va romanlar bo'yicha maxsus tuzilgan qiziqarli kitobxonlik testlari to'plami. Bilimingizni sinab ko'ring!
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  {yoshKitobxon.map((v, i) => (
                    <motion.div
                      key={i}
                      whileHover={{ y: -2, transition: { duration: 0.15 } }}
                      className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-center gap-2 text-indigo-600 font-bold text-xs uppercase tracking-wider mb-2">
                          <span className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-pulse"></span>
                          Badiiy asar testi
                        </div>
                        <h3 className="font-bold text-slate-850 text-sm mb-4 h-12 leading-snug">
                          {v.title}
                        </h3>
                      </div>
                      <div className="flex items-center justify-between border-t border-slate-100 pt-3 mt-2">
                        <span className="text-xs text-slate-500 flex items-center gap-1 font-semibold">
                          <FileText size={14} /> {v.questions.length} ta savol
                        </span>
                        <button
                          onClick={() => handleStartYoshKitobxon(i)}
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

            {/* NEW VAQTLI IMTIHONLAR TAB */}
            {activeTab === 'custom' && (
              <motion.div
                key="custom"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.3 }}
                className="space-y-6"
              >
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                  <h3 className="font-extrabold text-slate-800 text-sm flex items-center gap-2">
                    <Clock size={16} className="text-indigo-600 animate-spin" /> Vaqtli Imtihonlar Bo'limi
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">
                    Admin tomonidan joylangan imtihonlar. Test yaratilgandan so'ng 1 soat davomida faol bo'ladi. Har bir savolga 60 soniya vaqt beriladi.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  {customTests.map((t) => {
                    const isExpired = Date.now() > t.expiresAt;
                    return (
                      <div
                        key={t.id}
                        className={`bg-white rounded-xl shadow-sm border border-slate-200 p-5 flex flex-col justify-between relative overflow-hidden ${
                          isExpired ? 'opacity-60 bg-slate-100/80' : 'border-indigo-150'
                        }`}
                      >
                        {isExpired && (
                          <div className="absolute top-2 right-2 bg-red-100 text-red-750 text-[8px] font-black rounded px-1.5 py-0.5 uppercase">
                            Yopilgan
                          </div>
                        )}
                        <div>
                          <div className="flex items-center gap-1.5 text-indigo-600 font-bold text-[10px] uppercase mb-1">
                            <span className="w-1.5 h-1.5 bg-rose-500 rounded-full"></span>
                            {t.category === 'majburiy' ? '📕 Majburiy' : t.category === 'milliy' ? '🎓 Milliy' : '🧮 Ixtisoslash'}
                          </div>
                          <h3 className="font-bold text-slate-850 text-sm h-12 leading-snug">
                            {t.title}
                          </h3>
                        </div>
                        <div className="border-t border-slate-100 pt-3 mt-4 space-y-3">
                          <div className="flex justify-between items-center text-[10px] text-slate-500">
                            <span>Holati:</span>
                            <span className={`font-mono font-bold ${isExpired ? 'text-red-650' : 'text-emerald-600 animate-pulse'}`}>
                              {isExpired ? 'Tugagan (Closed)' : 'Faol (Active)'}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-slate-500 flex items-center gap-1 font-semibold">
                              📄 {t.questionsCount} ta savol
                            </span>
                            <button
                              disabled={isExpired}
                              onClick={() => {
                                setSelectedCustomTestId(t.id);
                                setStarted(true);
                                setCurrentQuestion(0);
                                setAnswers([]);
                                setFinished(false);
                              }}
                              className={`text-xs font-bold py-2 px-4 rounded-lg transition-colors flex items-center justify-center gap-1 cursor-pointer ${
                                isExpired
                                  ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                                  : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                              }`}
                            >
                              Imtihon <ChevronRight size={14} />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
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
                <AdminPanel currentUserId={userId} isAdmin={isAdmin} />
              </motion.div>
            )}
          </AnimatePresence>

          {/* HISTORICAL CERTIFICATES SECTION AT THE BOTTOM */}
          {activeTab !== 'admin' && (
            <div className="mt-16 bg-white border border-slate-250/80 rounded-2xl p-6 shadow-sm space-y-4">
              <h3 className="font-extrabold text-slate-850 text-md flex items-center gap-2">
                <Award size={18} className="text-indigo-600" /> Mening Sertifikatlarim va Tarixim
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                60 % va undan yuqori natija ko'rsatgan har bir imtihoningiz uchun rasmiy muhrli va verify-ID ga ega bo'lgan sertifikatni istalgan paytda chop etishingiz yoki PDF holida yuklab olishingiz mumkin.
              </p>

              {userResults.length === 0 ? (
                <div className="border border-dashed border-slate-200 py-6 text-center text-xs text-slate-400 rounded-xl">
                  Siz hozircha birorta test topshirmadingiz. Testlarni yakunlab sertifikatlarga ega bo'ling.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {userResults.map((resItem, index) => {
                    const isHighScorer = resItem.percentage >= 60;
                    return (
                      <div key={index} className="bg-slate-50 border border-slate-200/80 p-3.5 rounded-xl flex items-center justify-between text-xs gap-2">
                        <div className="space-y-1">
                          <p className="font-bold text-slate-800 leading-snug">{resItem.testTitle || 'Kalkulyator Imtihoni'}</p>
                          <div className="flex items-center gap-2 text-[10px] text-slate-500">
                            <span className="font-mono bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded font-black">Ball: {resItem.percentage}%</span>
                            <span>•</span>
                            <span>{new Date(resItem.timestamp).toLocaleDateString()}</span>
                          </div>
                        </div>

                        {isHighScorer ? (
                          <button
                            onClick={() => {
                              setCertPercentage(resItem.percentage);
                              setCertTestTitle(resItem.testTitle || 'Matematika Imtihoni');
                              setCertTestId(resItem.testId || 'quiz');
                              setShowCertificate(true);
                            }}
                            className="bg-amber-600 hover:bg-amber-700 text-white font-extrabold px-3 py-1.5 rounded-lg text-[10px] flex items-center gap-1 cursor-pointer transition active:scale-95"
                          >
                            <Printer size={12} /> Sertifikat
                          </button>
                        ) : (
                          <div className="text-[10px] text-slate-450 font-bold italic">Sertifikatsiz</div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Certificate Rendering Overlay */}
        {showCertificate && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm print:p-0 print:bg-white overflow-y-auto">
            <div className="w-full max-w-4xl bg-white rounded-2xl shadow-2xl p-6 border border-amber-200 relative my-8 print:shadow-none print:border-0 print:p-0 print:m-0">
              
              {/* Controls UI (Hidden during Printing) */}
              <div className="flex flex-col sm:flex-row gap-3 justify-between items-center mb-6 print:hidden">
                <div className="flex flex-col w-full sm:w-auto">
                  <label className="text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-wider block">Sertifikatdagi To'liq Ismingiz:</label>
                  <input
                    type="text"
                    value={certName}
                    onChange={(e) => setCertName(e.target.value)}
                    placeholder="Masalan: Dilnura Amadaminova"
                    className="bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs text-slate-800 outline-none focus:ring-2 focus:ring-amber-500 w-full sm:w-64 font-bold"
                  />
                </div>
                <div className="flex gap-2 self-end sm:self-auto">
                  <button
                    onClick={() => window.print()}
                    className="bg-amber-600 hover:bg-amber-700 text-white font-extrabold px-4 py-2 rounded-xl text-xs flex items-center gap-1 cursor-pointer transition"
                  >
                    <Printer size={14} /> Chop etish / PDF
                  </button>
                  <button
                    onClick={() => setShowCertificate(false)}
                    className="bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold px-4 py-2 rounded-xl text-xs cursor-pointer transition"
                  >
                    Yopish
                  </button>
                </div>
              </div>

              {/* Printable Certificate Frame */}
              <div id="certificate-print-area" className="border-[16px] border-double border-amber-600 p-8 sm:p-12 bg-stone-50 select-none text-center relative overflow-hidden shadow-inner print:border-[12px] print:p-8 print:bg-white" style={{ fontFamily: 'Georgia, serif' }}>
                
                {/* Gold Crest Icon */}
                <div className="mx-auto w-20 h-20 rounded-full border-4 border border-amber-500 bg-amber-50 flex items-center justify-center mb-5 shadow-sm">
                  <span className="text-3xl font-serif">🏆</span>
                </div>

                <h1 className="text-3xl sm:text-4xl font-serif font-extrabold text-amber-800 uppercase tracking-widest mb-1">CERTIFICATE</h1>
                <p className="text-[9px] text-amber-600 font-mono tracking-widest uppercase mb-6 block font-bold">MATEMATIKA IMTIHON PLATFORMASI @KITOBTANLOVBOT</p>

                <p className="text-slate-650 italic text-xs sm:text-sm mb-3">Ushbu nufuzli sertifikat</p>

                <h2 className="text-2xl sm:text-3xl font-serif font-extrabold text-slate-900 border-b-2 border-stone-300 pb-2 w-2/3 mx-auto mb-6 italic">
                  {certName || "Sinaluvchi Ishtirokchi"}
                </h2>

                <p className="text-slate-600 text-xs sm:text-sm max-w-lg mx-auto leading-relaxed mb-6">
                  matematika fanini o'rganishda chuqur qiziqish ko'rsatib, <strong>{certTestTitle}</strong> variantidan muvaffaqiyatli o'tib, jami <strong>{certPercentage}%</strong> to'g'ri ko'rsatkich qayd etganligi va 60% lik mutaxassis imtihon ko'rsatkichini bajarganligi munosabati bilan taqdim etiladi.
                </p>

                <div className="grid grid-cols-2 gap-6 mt-10 text-[10px] text-slate-500 border-t border-stone-200 pt-5">
                  <div className="text-left">
                    <p className="font-mono">VerifyID: ID-{userId}-{certTestId.slice(0, 8)}</p>
                    <p className="mt-1">Taqdim etilgan sana: {new Date().toLocaleDateString()}</p>
                  </div>
                  <div className="text-right flex flex-col items-end">
                    <div className="w-14 h-14 rounded-full border border-amber-500 flex items-center justify-center bg-amber-50/10 text-[8px] text-amber-700 font-bold relative mb-1">
                      TASDIQLANDI
                      <div className="absolute inset-1 border border-dashed border-amber-400 rounded-full"></div>
                    </div>
                    <p className="font-bold text-slate-800 font-serif">Bot Eksperti</p>
                  </div>
                </div>

                {/* Subtle Background Seals */}
                <div className="absolute top-4 right-4 text-3xl opacity-10">🎖️</div>
                <div className="absolute bottom-4 left-4 text-3xl opacity-10">📜</div>
              </div>

            </div>
          </div>
        )}
      </div>
    );
  }

  // EXAMS SOLVING CANVAS / INTERACTION
  const q = currentQuestions[currentQuestion];

  if (!q) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="text-center p-8 bg-white border border-slate-200 rounded-2xl w-full max-w-sm">
          <p className="text-slate-600 text-sm">Savollar yuklanmadi yoki test tahrirlanmoqda.</p>
          <button 
            onClick={handleBackToMenu}
            className="mt-4 bg-indigo-600 text-white font-semibold py-2 px-6 rounded-lg w-full cursor-pointer text-xs"
          >
            Orqaga qaytish
          </button>
        </div>
      </div>
    );
  }

  // RENDER TEST SOLVED / FINISHED SCORESHEET WITH EXPEDITED CERTIFICATE BUTTON
  if (finished && results) {
    const isHighScorer = results.percentage >= 60;
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
                <div className="text-xs text-slate-500 font-bold uppercase mb-1">To'g'ri Javoblar</div>
                <div className="text-3xl font-extrabold text-slate-800">{results.rawScore} / {currentQuestions.length}</div>
              </div>
              
              <div className="bg-emerald-50 rounded-xl p-6 border border-emerald-100">
                <BarChart3 className="mx-auto mb-2 text-emerald-600" size={32} />
                <div className="text-xs text-emerald-600 font-bold uppercase mb-1">Foiz ko'rsatkichi</div>
                <div className="text-3xl font-extrabold text-emerald-700">{results.percentage}%</div>
              </div>
            </div>

            {/* Expended Certificate Alert & Button */}
            {isHighScorer ? (
              <div className="bg-amber-50 border border-amber-200 p-5 rounded-2xl mb-8 space-y-3 max-w-lg mx-auto text-center">
                <div className="flex justify-center text-amber-500"><Award size={36} className="animate-spin" /></div>
                <h4 className="font-extrabold text-amber-850 text-sm">Tabriklaymiz! Siz 60% lik to'siqdan o'tdingiz 🥳</h4>
                <p className="text-xs text-amber-700">Pastdagi oltin tugmani bosib, shaxsiy sertifikatingizni chop etishingiz mumkin!</p>
                <button
                  onClick={() => {
                    setCertPercentage(results.percentage);
                    setCertTestTitle(currentTitle);
                    setCertTestId(selectedCustomTestId ? selectedCustomTestId : 'practice');
                    setShowCertificate(true);
                  }}
                  className="bg-amber-600 hover:bg-amber-700 text-white font-black px-6 py-2.5 rounded-xl text-xs inline-flex items-center gap-1 transition shadow-lg cursor-pointer active:scale-95 mx-auto"
                >
                  <Printer size={14} className="animate-bounce" /> Shaxsiy Sertifikatni Yuklash / Chop etish
                </button>
              </div>
            ) : (
              <div className="bg-rose-50 border border-rose-100 p-4 rounded-xl mb-8 max-w-sm mx-auto text-center">
                <p className="text-xs text-rose-700">Sertifikat olish uchun kamida <strong>60%</strong> to'g'ri ishlashingiz lozim (hozirda {results.percentage}%). Variantni qaytadan yechib ko'rishingiz mumkin.</p>
              </div>
            )}

            <button 
              onClick={handleBackToMenu}
              className="bg-slate-900 hover:bg-slate-850 text-white font-medium py-3 px-8 rounded-xl transition-all inline-flex items-center gap-2 cursor-pointer shadow-md text-xs"
            >
              <RotateCcw size={18} /> Bosh sahifaga qaytish
            </button>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="bg-slate-50 px-6 py-4 border-b border-slate-200">
              <h3 className="font-bold text-slate-800 text-sm">Savollar tahlili va yechimlar</h3>
            </div>
            <div className="divide-y divide-slate-100">
              {currentQuestions.map((ques, i) => {
                const isCorrect = results.isCorrect[i];
                
                return (
                  <div key={ques.id} className="p-6 hover:bg-slate-50 transition-colors">
                    <div className="flex gap-4">
                      <div className="mt-1 flex-shrink-0">
                        {isCorrect ? (
                          <CheckCircle2 className="text-emerald-500" size={24} />
                        ) : (
                          <XCircle className="text-red-500" size={24} />
                        )}
                      </div>
                      <div className="flex-1">
                        {ques.imageUrl && (
                          <div className="mb-3">
                            <img src={ques.imageUrl} alt="Savol rasmi" className="max-w-full h-auto max-h-40 rounded-lg shadow-sm" referrerPolicy="no-referrer" />
                          </div>
                        )}
                        <div className="font-bold text-slate-800 mb-3 text-sm">{i + 1}. {ques.text}</div>
                        
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-4">
                          {ques.options.map((opt, optIdx) => {
                            let itemClass = "px-4 py-3 rounded-xl text-xs border font-medium ";
                            if (optIdx === ques.correct) {
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

        {/* Certificate Modal inside finishing scoresheet */}
        {showCertificate && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm print:p-0 print:bg-white overflow-y-auto">
            <div className="w-full max-w-4xl bg-white rounded-2xl shadow-2xl p-6 border border-amber-200 relative my-8 print:shadow-none print:border-0 print:p-0 print:m-0">
              
              {/* Controls UI (Hidden during Printing) */}
              <div className="flex flex-col sm:flex-row gap-3 justify-between items-center mb-6 print:hidden">
                <div className="flex flex-col w-full sm:w-auto">
                  <label className="text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-wider block">Sertifikatdagi To'liq Ismingiz:</label>
                  <input
                    type="text"
                    value={certName}
                    onChange={(e) => setCertName(e.target.value)}
                    placeholder="Masalan: Dilnura Amadaminova"
                    className="bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs text-slate-800 outline-none focus:ring-2 focus:ring-amber-500 w-full sm:w-64 font-bold"
                  />
                </div>
                <div className="flex gap-2 self-end sm:self-auto">
                  <button
                    onClick={() => {
                      window.print();
                    }}
                    className="bg-amber-600 hover:bg-amber-700 text-white font-extrabold px-4 py-2 rounded-xl text-xs flex items-center gap-1 cursor-pointer transition"
                  >
                    <Printer size={14} /> Chop etish / PDF
                  </button>
                  <button
                    onClick={() => setShowCertificate(false)}
                    className="bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold px-4 py-2 rounded-xl text-xs cursor-pointer transition"
                  >
                    Yopish
                  </button>
                </div>
              </div>

              {/* Printable Certificate Frame */}
              <div id="certificate-print-area" className="border-[16px] border-double border-amber-600 p-8 sm:p-12 bg-stone-50 select-none text-center relative overflow-hidden shadow-inner print:border-[12px] print:p-8 print:bg-white" style={{ fontFamily: 'Georgia, serif' }}>
                
                {/* Gold Crest Icon */}
                <div className="mx-auto w-20 h-20 rounded-full border-4 border-amber-505 bg-amber-50 flex items-center justify-center mb-5 shadow-sm">
                  <span className="text-3xl font-serif">🏆</span>
                </div>

                <h1 className="text-3xl sm:text-4xl font-serif font-extrabold text-amber-800 uppercase tracking-widest mb-1">CERTIFICATE</h1>
                <p className="text-[9px] text-amber-600 font-mono tracking-widest uppercase mb-6 block font-bold">MATEMATIKA IMTIHON PLATFORMASI @KITOBTANLOVBOT</p>

                <p className="text-slate-655 italic text-xs sm:text-sm mb-3">Ushbu nufuzli sertifikat</p>

                <h2 className="text-2xl sm:text-3xl font-serif font-extrabold text-slate-900 border-b-2 border-stone-300 pb-2 w-2/3 mx-auto mb-6 italic">
                  {certName || "Sinaluvchi Ishtirokchi"}
                </h2>

                <p className="text-slate-605 text-xs sm:text-sm max-w-lg mx-auto leading-relaxed mb-6">
                  matematika fanini o'rganishda chuqur qiziqish ko'rsatib, <strong>{certTestTitle}</strong> variantidan muvaffaqiyatli o'tib, jami <strong>{certPercentage}%</strong> to'g'ri ko'rsatkich qayd etganligi va 60% lik mutaxassis imtihon ko'rsatkichini bajarganligi munosabati bilan taqdim etiladi.
                </p>

                <div className="grid grid-cols-2 gap-6 mt-10 text-[10px] text-slate-505 border-t border-stone-200 pt-5">
                  <div className="text-left">
                    <p className="font-mono">VerifyID: ID-{userId}-{certTestId.slice(0, 8)}</p>
                    <p className="mt-1">Taqdim etilgan sana: {new Date().toLocaleDateString()}</p>
                  </div>
                  <div className="text-right flex flex-col items-end">
                    <div className="w-14 h-14 rounded-full border border-amber-500 flex items-center justify-center bg-amber-50/10 text-[8px] text-amber-705 font-bold relative mb-1">
                      TASDIQLANDI
                      <div className="absolute inset-1 border border-dashed border-amber-400 rounded-full"></div>
                    </div>
                    <p className="font-bold text-slate-805 font-serif">Bot Eksperti</p>
                  </div>
                </div>

                {/* Subtle Background Seals */}
                <div className="absolute top-4 right-4 text-3xl opacity-10">🎖️</div>
                <div className="absolute bottom-4 left-4 text-3xl opacity-10">📜</div>
              </div>

            </div>
          </div>
        )}
      </div>
    );
  }

  // ACTIVE QUESTIONS INTERACTIVE SOLVING
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 font-sans print-hide">
      <div className="max-w-2xl w-full">
        {/* Quiz Navigator Header */}
        <div className="mb-4 flex items-center justify-between">
          <button
            onClick={handleBackToMenu}
            className="text-xs font-bold text-slate-505 hover:text-slate-800 flex items-center gap-1 bg-white hover:bg-slate-100 border border-slate-205 px-3 py-1.5 rounded-lg transition-all cursor-pointer"
          >
            <ChevronLeft size={14} /> Chiqish
          </button>
          <div className="text-xs font-black text-indigo-600 uppercase tracking-wider">
            {currentTitle}
          </div>
        </div>

        <div className="mb-4 flex items-center justify-between">
          <div className="text-xs font-bold text-slate-500 uppercase">
            Savol {currentQuestion + 1} / {currentQuestions.length}
          </div>
          
          {/* BEAUTIFUL ACTIVE TIME CONTROLLER */}
          <div className="flex items-center gap-2 bg-white border border-slate-205 py-1 px-3.5 rounded-xl shadow-xs">
            <Clock size={13} className={`animate-spin ${timeLeft <= 15 ? 'text-rose-500' : 'text-indigo-600'}`} />
            <span className={`font-mono text-xs font-black ${timeLeft <= 15 ? 'text-rose-600 animate-pulse' : 'text-slate-805'}`}>
              {timeLeft} soniya
            </span>
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
              <img src={q.imageUrl} alt="Savol rasmi" className="max-w-full h-auto max-h-64 rounded-lg shadow-sm" referrerPolicy="no-referrer" />
            </div>
          )}
          <h2 className="text-lg font-bold text-slate-800 mb-8 leading-relaxed">
            {q.text}
          </h2>
          
          <div className="space-y-3">
            {q.options.map((opt, i) => (
              <button
                key={i}
                onClick={() => handleAnswer(i)}
                className="w-full text-left px-5 py-3.5 rounded-xl border-2 border-slate-100 hover:border-indigo-600 hover:bg-indigo-50/50 transition-all font-semibold text-slate-700 hover:text-indigo-950 flex items-center gap-4 group cursor-pointer text-xs"
              >
                <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-slate-100 text-slate-500 group-hover:bg-indigo-600 group-hover:text-white transition-colors font-bold text-xs">
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
