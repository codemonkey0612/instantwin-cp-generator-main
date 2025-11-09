import React from 'react';

interface Result {
  question: string;
  type: string;
  totalAnswers: number;
  answerCounts: Record<string, number>;
  textAnswers: string[];
}

interface Field {
  id: string;
  question: string;
  type: string;
  options?: string[];
}

interface SurveyResultsDashboardProps {
  results: Result[];
  fields: Field[];
  onDownloadCsv?: () => void;
}

const COLORS = ['bg-sky-500', 'bg-emerald-500', 'bg-amber-500', 'bg-rose-500', 'bg-indigo-500', 'bg-teal-500'];

const SurveyResultsDashboard: React.FC<SurveyResultsDashboardProps> = ({ results, fields, onDownloadCsv }) => {
  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <h3 className="text-xl font-bold text-slate-900">アンケート結果</h3>
        {onDownloadCsv && (
          <button
            onClick={onDownloadCsv}
            className="px-4 py-2 text-sm font-medium bg-slate-600 text-white rounded-md hover:bg-slate-700 transition-colors shadow-sm"
          >
            CSVダウンロード
          </button>
        )}
      </div>
      {results.map((result, index) => {
        const field = fields[index];
        if (!field) return null;

        const isChoice = ['radio', 'checkbox', 'select'].includes(result.type);
        
        return (
          <div key={index} className="bg-white p-6 rounded-lg shadow-md border border-slate-200">
            <h4 className="font-semibold text-slate-800">{result.question}</h4>
            <p className="text-xs text-slate-500 mb-4">総回答数: {result.totalAnswers}件</p>
            
            {result.totalAnswers === 0 ? (
              <p className="text-sm text-slate-400 text-center py-4">まだ回答がありません。</p>
            ) : isChoice ? (
              <div className="space-y-3">
                {(field.options || []).filter(opt => opt.trim()).map((option, optionIndex) => {
                  const count = result.answerCounts[option] || 0;
                  const percentage = result.totalAnswers > 0 ? (count / result.totalAnswers) * 100 : 0;
                  const barColor = COLORS[optionIndex % COLORS.length];

                  return (
                    <div key={option}>
                      <div className="flex justify-between items-center text-sm mb-1">
                        <span className="text-slate-700">{option}</span>
                        <span className="font-medium text-slate-600">{count}票 ({percentage.toFixed(1)}%)</span>
                      </div>
                      <div className="w-full bg-slate-200 rounded-full h-2.5 overflow-hidden">
                        <div
                          className={`${barColor} h-2.5 rounded-full transition-all duration-500`}
                          style={{ width: `${percentage}%` }}
                        ></div>
                      </div>
                    </div>
                  );
                })}
                {result.type === 'checkbox' && (
                    <p className="text-xs text-slate-500 pt-2">* 複数選択が可能なため、パーセンテージの合計は100%を超える場合があります。</p>
                )}
              </div>
            ) : ( // text, textarea
              <div className="max-h-60 overflow-y-auto space-y-2 pr-2 border-l-4 border-slate-200 pl-4">
                {result.textAnswers.length > 0 ? (
                  result.textAnswers.map((text, i) => (
                    <p key={i} className="text-sm text-slate-700 p-2 bg-slate-50 border border-slate-200 rounded-md whitespace-pre-wrap">{text}</p>
                  ))
                ) : (
                  <p className="text-sm text-slate-400">回答がありません。</p>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default SurveyResultsDashboard;