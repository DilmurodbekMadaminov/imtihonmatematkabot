/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { CheckCircle2, XCircle, ChevronRight, RotateCcw, BrainCircuit, BarChart3, Target, Activity } from 'lucide-react';
import { variants } from './questions';
import AdminPanel from './AdminPanel';

function QuizApp() {
  const [selectedVariant, setSelectedVariant] = useState<number | null>(null);
  const [started, setStarted] = useState(false);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<number[]>([]);
  const [finished, setFinished] = useState(false);

  const handleStart = (variantIndex: number) => {
    setSelectedVariant(variantIndex);
    setStarted(true);
    setCurrentQuestion(0);
    setAnswers([]);
    setFinished(false);
  };

  const handleBackToMenu = () => {
    setSelectedVariant(null);
    setStarted(false);
    setFinished(false);
  };

  const currentQuestions = selectedVariant !== null ? variants[selectedVariant] : [];

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
    if (!finished || selectedVariant === null) return null;
    
    const isCorrect = answers.map((ans, i) => ans === currentQuestions[i].correct);
    const rawScore = isCorrect.filter(Boolean).length;
    const percentage = Math.round((rawScore / currentQuestions.length) * 100);
    
    return {
      isCorrect,
      rawScore,
      percentage
    };
  }, [answers, finished, selectedVariant, currentQuestions]);

  if (!started || selectedVariant === null) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 font-sans">
        <div className="max-w-2xl w-full bg-white rounded-2xl shadow-xl overflow-hidden p-8 text-center">
          <div className="bg-indigo-100 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
            <BrainCircuit size={40} className="text-indigo-600" />
          </div>
          <h1 className="text-3xl font-bold text-slate-800 mb-4">Matematika Testi</h1>
          <p className="text-slate-600 mb-8 leading-relaxed">
            Ushbu test Milliy Sertifikat savollari asosida tuzilgan. Test yakunida sizning natijangiz foizda hisoblanadi. Qaysi variantni ishlashni xohlaysiz?
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {variants.map((_, i) => (
              <button 
                key={i}
                onClick={() => handleStart(i)}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 px-6 rounded-xl transition-colors inline-flex items-center justify-center gap-2 cursor-pointer"
              >
                Variant {i + 1} <ChevronRight size={20} />
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (finished && results) {
    return (
      <div className="min-h-screen bg-slate-50 py-12 px-4 font-sans">
        <div className="max-w-3xl mx-auto space-y-6">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 text-center">
            <h2 className="text-2xl font-bold text-slate-800 mb-6">Test Natijalari</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
              <div className="bg-slate-50 rounded-xl p-6 border border-slate-100">
                <Target className="mx-auto mb-2 text-blue-500" size={32} />
                <div className="text-sm text-slate-500 font-medium mb-1">To'g'ri Javoblar</div>
                <div className="text-3xl font-bold text-slate-800">{results.rawScore} / {currentQuestions.length}</div>
              </div>
              
              <div className="bg-emerald-50 rounded-xl p-6 border border-emerald-100">
                <BarChart3 className="mx-auto mb-2 text-emerald-500" size={32} />
                <div className="text-sm text-emerald-600 font-medium mb-1">Natija</div>
                <div className="text-3xl font-bold text-emerald-700">{results.percentage}%</div>
              </div>
            </div>

            <button 
              onClick={handleBackToMenu}
              className="bg-slate-800 hover:bg-slate-900 text-white font-medium py-2.5 px-6 rounded-lg transition-colors inline-flex items-center gap-2 cursor-pointer"
            >
              <RotateCcw size={18} /> Bosh Menyu
            </button>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="bg-slate-50 px-6 py-4 border-b border-slate-200">
              <h3 className="font-semibold text-slate-800">Savollar tahlili</h3>
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
                        <div className="font-medium text-slate-800 mb-3">{i + 1}. {q.text}</div>
                        
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-4">
                          {q.options.map((opt, optIdx) => {
                            let itemClass = "px-3 py-2 rounded-md text-sm border ";
                            if (optIdx === q.correct) {
                              itemClass += "bg-emerald-50 border-emerald-200 text-emerald-800 font-medium";
                            } else if (optIdx === answers[i]) {
                              itemClass += "bg-red-50 border-red-200 text-red-800";
                            } else {
                              itemClass += "bg-white border-slate-200 text-slate-600";
                            }
                            
                            return (
                              <div key={optIdx} className={itemClass}>
                                {String.fromCharCode(65 + optIdx)}) {opt}
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

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 font-sans">
      <div className="max-w-2xl w-full">
        <div className="mb-6 flex items-center justify-between">
          <div className="text-sm font-medium text-slate-500 uppercase tracking-wider">
            Savol {currentQuestion + 1} / {currentQuestions.length}
          </div>
        </div>
        
        <div className="w-full bg-slate-200 h-2 rounded-full mb-8 overflow-hidden">
          <div 
            className="bg-indigo-600 h-full transition-all duration-300 ease-out"
            style={{ width: `${((currentQuestion) / currentQuestions.length) * 100}%` }}
          ></div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 mb-6">
          {q.imageUrl && (
            <div className="mb-6 flex justify-center">
              <img src={q.imageUrl} alt="Savol rasmi" className="max-w-full h-auto max-h-64 rounded-lg shadow-sm" />
            </div>
          )}
          <h2 className="text-xl font-medium text-slate-800 mb-8 leading-relaxed">
            {q.text}
          </h2>
          
          <div className="space-y-3">
            {q.options.map((opt, i) => (
              <button
                key={i}
                onClick={() => handleAnswer(i)}
                className="w-full text-left px-6 py-4 rounded-xl border-2 border-slate-100 hover:border-indigo-600 hover:bg-indigo-50 transition-all font-medium text-slate-700 hover:text-indigo-900 flex items-center gap-4 group cursor-pointer"
              >
                <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-slate-100 text-slate-500 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                  {String.fromCharCode(65 + i)}
                </span>
                {opt}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<QuizApp />} />
        <Route path="/admin" element={<AdminPanel />} />
      </Routes>
    </Router>
  );
}
