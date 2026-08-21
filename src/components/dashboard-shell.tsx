"use client";

import {
  ArrowDownRight,
  ArrowUpRight,
  Bell,
  BookOpen,
  Building2,
  CalendarClock,
  ChevronDown,
  CircleHelp,
  FileCheck2,
  FileText,
  Landmark,
  LayoutDashboard,
  Menu,
  MessageCircle,
  Plus,
  ReceiptText,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  Upload,
  Users,
  WalletCards,
  X,
} from "lucide-react";
import { useState } from "react";
import { attentionItems, compliance, metrics } from "@/lib/demo-data";

const nav = [
  { label: "Overview", icon: LayoutDashboard, active: true },
  { label: "Transactions", icon: WalletCards },
  { label: "Invoices", icon: ReceiptText },
  { label: "Accounting", icon: BookOpen },
  { label: "Taxes", icon: Landmark },
  { label: "Compliance", icon: FileCheck2, badge: "2" },
  { label: "Documents", icon: FileText },
];

export function DashboardShell() {
  const [mobileNav, setMobileNav] = useState(false);

  return (
    <main className="app-shell">
      <aside className={`sidebar ${mobileNav ? "sidebar-open" : ""}`}>
        <div className="brand-row">
          <div className="brand-mark"><span>Z</span></div>
          <div className="brand-word">Zuelen</div>
          <button className="icon-btn mobile-only" onClick={() => setMobileNav(false)} aria-label="Close navigation"><X size={18} /></button>
        </div>

        <button className="company-switcher">
          <span className="company-avatar">T</span>
          <span className="company-copy">
            <strong>TradinGo SARL-S</strong>
            <small>2026 financial year</small>
          </span>
          <ChevronDown size={16} />
        </button>

        <nav className="nav-list" aria-label="Primary navigation">
          {nav.map((item) => (
            <button key={item.label} className={`nav-item ${item.active ? "nav-active" : ""}`}>
              <item.icon size={18} strokeWidth={1.8} />
              <span>{item.label}</span>
              {item.badge ? <em>{item.badge}</em> : null}
            </button>
          ))}
        </nav>

        <div className="sidebar-spacer" />
        <div className="sidebar-insight">
          <div className="insight-icon"><ShieldCheck size={18} /></div>
          <div>
            <strong>Books are healthy</strong>
            <p>98% of 2026 is reconciled.</p>
          </div>
          <span className="health-dot" />
        </div>
        <div className="nav-list nav-list-bottom">
          <button className="nav-item"><CircleHelp size={18} /><span>Help center</span></button>
          <button className="nav-item"><Settings size={18} /><span>Settings</span></button>
        </div>
        <div className="user-row">
          <div className="user-avatar">SR</div>
          <div><strong>Shayan Ramezani</strong><small>Owner</small></div>
          <ChevronDown size={16} />
        </div>
      </aside>

      {mobileNav ? <button className="scrim" aria-label="Close navigation" onClick={() => setMobileNav(false)} /> : null}

      <section className="workspace">
        <header className="topbar">
          <div className="topbar-left">
            <button className="icon-btn mobile-only" onClick={() => setMobileNav(true)} aria-label="Open navigation"><Menu size={19} /></button>
            <div className="crumb"><Building2 size={15} /><span>TradinGo SARL-S</span><span>/</span><strong>Overview</strong></div>
          </div>
          <div className="topbar-actions">
            <button className="search-btn"><Search size={16} /><span>Search Zuelen</span><kbd>⌘ K</kbd></button>
            <button className="icon-btn"><Bell size={18} /><span className="notification-dot" /></button>
            <button className="primary-btn"><Plus size={17} /><span>New</span></button>
          </div>
        </header>

        <div className="content-wrap">
          <div className="intro-row">
            <div>
              <p className="eyebrow">Sunday, 16 August</p>
              <h1>Good evening, Shayan.</h1>
              <p className="intro-copy">Your company is in good shape. There are <strong>3 things</strong> worth your attention.</p>
            </div>
            <div className="intro-actions">
              <button className="secondary-btn"><Upload size={16} />Upload document</button>
              <button className="period-btn"><CalendarClock size={16} />2026<ChevronDown size={15} /></button>
            </div>
          </div>

          <section className="hero-grid">
            <article className="safe-cash-panel">
              <div className="panel-kicker"><span className="live-dot" />Safe to use</div>
              <div className="cash-main">
                <div>
                  <div className="big-money">€9,440<span>.00</span></div>
                  <p>Available after known tax and VAT reserves.</p>
                </div>
                <div className="cash-ring" aria-label="66 percent of cash available">
                  <div><strong>66%</strong><span>free cash</span></div>
                </div>
              </div>
              <div className="cash-breakdown">
                <div><span>Bank balance</span><strong>€14,200</strong></div>
                <div className="minus"><span>Reserved</span><strong>− €4,760</strong></div>
                <div className="divider" />
                <div><span>Last 30 days</span><strong className="positive"><ArrowUpRight size={15} />€2,310</strong></div>
              </div>
              <div className="hero-watermark">Z</div>
            </article>

            <article className="deadline-panel">
              <div className="deadline-top">
                <div className="authority-badge">ACD</div>
                <span className="status-chip warning-chip">Next deadline</span>
              </div>
              <div className="deadline-date"><span>10</span><small>SEP</small></div>
              <h2>Corporate income tax advance</h2>
              <p>Quarterly advance payment · IRC</p>
              <div className="deadline-bottom"><strong>€275.00</strong><button>Mark as paid</button></div>
            </article>
          </section>

          <section className="metrics-row">
            {metrics.map((metric) => (
              <article className="metric" key={metric.label}>
                <span>{metric.label}</span>
                <div className="metric-value">{metric.value}</div>
                <small className={metric.tone}>{metric.tone === "positive" ? <ArrowUpRight size={13} /> : metric.tone === "warning" ? <ArrowDownRight size={13} /> : null}{metric.change}</small>
              </article>
            ))}
          </section>

          <section className="main-grid">
            <article className="attention-panel">
              <div className="section-head">
                <div><p className="section-kicker">Attention</p><h2>Your accounting inbox</h2></div>
                <button className="text-btn">View all <span>7</span></button>
              </div>
              <div className="inbox-list">
                {attentionItems.map((item, index) => (
                  <button className="inbox-item" key={item.title}>
                    <span className={`item-icon ${item.type}`}>
                      {item.type === "missing" ? <Upload size={17} /> : item.type === "eu" ? <Landmark size={17} /> : <ReceiptText size={17} />}
                    </span>
                    <span className="item-copy"><strong>{item.title}</strong><small>{item.detail}</small></span>
                    <span className="item-action">{item.meta}</span>
                    <span className="item-index">0{index + 1}</span>
                  </button>
                ))}
              </div>
              <div className="inbox-footer"><Sparkles size={15} /><span>Zuelen grouped 12 similar Adobe transactions automatically.</span><button>Review rule</button></div>
            </article>

            <aside className="reserve-panel">
              <div className="section-head compact"><div><p className="section-kicker">Tax reserve</p><h2>€4,760</h2></div><span className="status-chip good-chip">On track</span></div>
              <div className="reserve-visual">
                <div className="reserve-bars">
                  {[44, 61, 49, 70, 58, 76, 68, 84].map((height, i) => <span key={i} style={{ height: `${height}%` }} />)}
                </div>
                <div className="target-line"><span>recommended</span></div>
              </div>
              <div className="reserve-row"><span>VAT reserve</span><strong>€1,470</strong></div>
              <div className="reserve-row"><span>Est. direct taxes</span><strong>€3,290</strong></div>
              <button className="reserve-cta">See calculation <ArrowUpRight size={15} /></button>
            </aside>
          </section>

          <section className="compliance-section">
            <div className="section-head">
              <div><p className="section-kicker">Compliance runway</p><h2>Know what comes next.</h2></div>
              <button className="secondary-btn small"><CalendarClock size={15} />Open calendar</button>
            </div>
            <div className="compliance-track">
              {compliance.map((item, index) => (
                <article className={`compliance-card ${item.status}`} key={item.authority}>
                  <div className="compliance-number">0{index + 1}</div>
                  <div className="compliance-node"><span /></div>
                  <div className="compliance-body">
                    <span className="authority-label">{item.authority}</span>
                    <strong>{item.title}</strong>
                    <small>{item.date}</small>
                    {item.amount ? <b>{item.amount}</b> : null}
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section className="bottom-grid">
            <article className="readiness-panel">
              <div>
                <p className="section-kicker">2026 year-end readiness</p>
                <h2>98% complete</h2>
                <p>Your ledger is almost ready to produce annual accounts. Two documents still need review.</p>
              </div>
              <div className="readiness-meter"><span style={{ width: "98%" }} /></div>
              <div className="readiness-meta"><span><i className="done-dot" />Bank reconciled</span><span><i className="done-dot" />Sales complete</span><span><i className="wait-dot" />2 documents</span></div>
            </article>
            <article className="assistant-panel">
              <div className="assistant-icon"><Sparkles size={21} /></div>
              <div><span className="assistant-label">Zuelen intelligence</span><h2>Ask your company anything.</h2><p>“How much can I safely take out this month?”</p></div>
              <button><MessageCircle size={17} />Ask Zuelen</button>
            </article>
          </section>

          <footer className="product-footer"><span>Zuelen preview · Luxembourg-first accounting</span><span><ShieldCheck size={14} />Financial data protected</span><span><Users size={14} />Built for owner-operated companies</span></footer>
        </div>
      </section>
    </main>
  );
}
