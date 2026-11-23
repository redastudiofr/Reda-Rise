'use client';

import { useState } from 'react';
import { Icon } from '@/components/Icon';
import { Toast } from '@/components/Toast';

// Données d'aperçu floutées : elles ne reflètent pas de vraies statistiques.
const WEEK = [40, 72, 55, 90, 64, 30, 82];
const HEAT = Array.from({ length: 28 }, (_, i) => (i * 37) % 5);

export default function StatsPage() {
  const [toast, setToast] = useState<string | null>(null);

  return (
    <>
      <div className="page-head">
        <h1 className="page-title">Statistiques</h1>
      </div>

      <div className="locked">
        <div className="locked-blur" aria-hidden="true">
          <div className="card chart">
            <div className="chart-head">
              <div>
                <h3>Cette semaine</h3>
                <div className="row-sub">3 habitudes</div>
              </div>
            </div>
            <div className="chart-bars">
              {WEEK.map((h, i) => (
                <i key={i} style={{ height: `${h}%`, animationDelay: `${i * 0.05}s` }} />
              ))}
            </div>
          </div>

          <h3 className="group-title" style={{ marginTop: 26 }}>
            Humeur
          </h3>
          <div className="card chart">
            <div className="heat">
              {HEAT.map((v, i) => (
                <i key={i} style={{ opacity: 0.3 + v * 0.16 }} />
              ))}
            </div>
          </div>
        </div>

        <button
          className="btn-primary locked-cta"
          onClick={() => setToast('Hustly Pro bientôt disponible')}
        >
          <Icon name="lock" size={16} />
          Débloquer Pro
          <Icon name="arrow" size={18} strokeWidth={2.2} />
        </button>
      </div>

      <Toast message={toast} />
    </>
  );
}
