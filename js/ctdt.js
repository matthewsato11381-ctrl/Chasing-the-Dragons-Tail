document.addEventListener("DOMContentLoaded", () => {
    const SECURE_TOKEN = "dragon_tail_secure_key_2026";
    let allReports = [];
    let reportsByDate = {}; // YYYY-MM-DD -> report obj
    let currentMonthStr = ""; // YYYY-MM
  
    const calendarGrid = document.getElementById("calendarGrid");
    const monthSelect = document.getElementById("monthSelect");
    const reportViewer = document.getElementById("reportViewer");
    const reportContent = document.getElementById("reportContent");
    const reportDate = document.getElementById("reportDate");
    const pdfDownloadLink = document.getElementById("pdfDownloadLink");
    const loadingIndicator = document.getElementById("loadingIndicator");
  
    async function init() {
      try {
        const res = await fetch(`/api/ctdt/reports?token=${SECURE_TOKEN}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || "Failed to load reports");
  
        allReports = data.reports || [];
        
        // Map reports by date (taking the newest one if multiple exist on same day)
        allReports.forEach(r => {
          if (!reportsByDate[r.date]) {
            reportsByDate[r.date] = r;
          }
        });
  
        setupMonthSelector();
        
        // Default to current month or latest report month
        const today = new Date();
        currentMonthStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
        
        if (allReports.length > 0) {
          const latestReport = allReports[0];
          // If latest report is in a different month, show that month
          if (latestReport.date.substring(0, 7) !== currentMonthStr && !reportsByDate[`${currentMonthStr}-${String(today.getDate()).padStart(2, '0')}`]) {
              currentMonthStr = latestReport.date.substring(0, 7);
              monthSelect.value = currentMonthStr;
          }
          renderCalendar(currentMonthStr);
          showReport(latestReport);
        } else {
          renderCalendar(currentMonthStr);
        }
  
      } catch (err) {
        console.error(err);
        loadingIndicator.textContent = "Error: Unauthorized or Connection Failed.";
      } finally {
        loadingIndicator.style.display = "none";
      }
    }
  
    function setupMonthSelector() {
      // Find all unique months
      const months = new Set();
      
      // Always include current month
      const today = new Date();
      months.add(`${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`);
      
      allReports.forEach(r => {
        months.add(r.date.substring(0, 7));
      });
  
      const sortedMonths = Array.from(months).sort().reverse();
      
      monthSelect.innerHTML = "";
      sortedMonths.forEach(m => {
        const [yy, mm] = m.split("-");
        const dateObj = new Date(parseInt(yy), parseInt(mm) - 1, 1);
        const monthName = dateObj.toLocaleString('default', { month: 'long', year: 'numeric' });
        
        const opt = document.createElement("option");
        opt.value = m;
        opt.textContent = monthName;
        monthSelect.appendChild(opt);
      });
  
      monthSelect.addEventListener("change", (e) => {
        currentMonthStr = e.target.value;
        renderCalendar(currentMonthStr);
      });
    }
  
    function renderCalendar(monthStr) {
      calendarGrid.innerHTML = "";
      const [yy, mm] = monthStr.split("-");
      const year = parseInt(yy);
      const month = parseInt(mm) - 1;
      
      const firstDay = new Date(year, month, 1).getDay(); // 0 (Sun) to 6 (Sat)
      const daysInMonth = new Date(year, month + 1, 0).getDate();
  
      // Headers
      const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      days.forEach(d => {
        const el = document.createElement("div");
        el.className = "cal-day-header";
        el.textContent = d;
        calendarGrid.appendChild(el);
      });
  
      // Blanks before first day
      for (let i = 0; i < firstDay; i++) {
        const el = document.createElement("div");
        el.className = "cal-day empty";
        calendarGrid.appendChild(el);
      }
  
      // Days
      const today = new Date();
      const currentFullDateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  
      for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const hasReport = !!reportsByDate[dateStr];
        const isPastOrToday = dateStr <= currentFullDateStr;
        
        const el = document.createElement("div");
        el.className = `cal-day ${hasReport ? 'has-report' : (isPastOrToday ? 'no-report' : '')}`;
        
        let iconHtml = "";
        if (hasReport) {
            iconHtml = `<span class="status-icon">✓</span>`;
        } else if (isPastOrToday) {
            iconHtml = `<span class="status-icon">✗</span>`;
        }
        
        el.innerHTML = `<div>${day}</div>${iconHtml}`;
        
        if (hasReport) {
          el.addEventListener("click", () => showReport(reportsByDate[dateStr]));
        } else if (isPastOrToday) {
            el.style.opacity = "0.5";
            el.addEventListener("click", () => alert("No intelligence report available for this date."));
        } else {
            el.style.opacity = "0.2";
        }
        
        calendarGrid.appendChild(el);
      }
    }
  
    function parseReport(bodyText) {
      let html = "";
      const lines = bodyText.split('\n');
      
      let inArticle = false;
      let article = {};
      
      function renderArticle() {
        if (!article.title) return "";
        let out = `<div class="article-box">`;
        out += `<h3 class="article-title">${article.title}</h3>`;
        
        out += `<div class="article-meta">`;
        if (article.relScore) {
          out += `<span class="reliability-badge">REL: ${article.relScore}</span>`;
        }
        if (article.relBluf) {
          out += `<span>${article.relBluf}</span>`;
        }
        out += `</div>`;
        
        if (article.bluf) {
          out += `<div class="article-bluf">${article.bluf}</div>`;
        }
        
        // Render occurred eventTime and projectedEnd cleanly in dual-column
        const hasEventTime = article.eventTime && article.eventTime.trim() !== "" && article.eventTime.trim().toUpperCase() !== "N/A";
        const hasProjectedEnd = article.projectedEnd && article.projectedEnd.trim() !== "" && article.projectedEnd.trim().toUpperCase() !== "N/A";
        
        if (hasEventTime || hasProjectedEnd) {
          out += `<div class="article-duration-details" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin-bottom: 1rem; padding: 0.75rem; background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05); border-radius: 4px; font-size: 0.8rem; font-family: var(--font-mono);">`;
          
          if (hasEventTime) {
            out += `<div>`;
            out += `<span style="color: var(--gold-primary); font-weight: bold; text-transform: uppercase; font-size: 0.7rem; letter-spacing: 1px; display: block; margin-bottom: 0.2rem;">📅 Event Date/Time</span>`;
            out += `<span style="color: var(--text-light);">${article.eventTime}</span>`;
            out += `</div>`;
          } else {
            out += `<div>`;
            out += `<span style="color: var(--gold-primary); font-weight: bold; text-transform: uppercase; font-size: 0.7rem; letter-spacing: 1px; display: block; margin-bottom: 0.2rem;">📅 Event Date/Time</span>`;
            out += `<span style="color: var(--text-ash);">N/A / Unspecified</span>`;
            out += `</div>`;
          }
          
          if (hasProjectedEnd) {
            out += `<div>`;
            out += `<span style="color: var(--crimson); font-weight: bold; text-transform: uppercase; font-size: 0.7rem; letter-spacing: 1px; display: block; margin-bottom: 0.2rem;">🔄 Projected End / Status</span>`;
            out += `<span style="color: var(--text-light);">${article.projectedEnd}</span>`;
            if (article.endReason && article.endReason.trim() !== "" && article.endReason.trim().toUpperCase() !== "N/A") {
              out += `<span style="color: var(--text-ash); display: block; margin-top: 0.2rem; font-style: italic; font-size: 0.75rem;">Reason: ${article.endReason}</span>`;
            }
            out += `</div>`;
          } else {
            out += `<div>`;
            out += `<span style="color: var(--crimson); font-weight: bold; text-transform: uppercase; font-size: 0.7rem; letter-spacing: 1px; display: block; margin-bottom: 0.2rem;">🔄 Projected End / Status</span>`;
            out += `<span style="color: var(--text-ash);">Completed / N/A</span>`;
            out += `</div>`;
          }
          
          out += `</div>`;
        }
        
        if (article.coreIntel && article.coreIntel.length > 0) {
          out += `<div class="core-intel"><ul>`;
          article.coreIntel.forEach(li => { out += `<li>${li}</li>`; });
          out += `</ul></div>`;
        }
        
        if (article.matrix && article.matrix.length > 0) {
          out += `<div class="pred-matrix"><div class="pred-matrix-title">Predictive Matrix</div>`;
          article.matrix.forEach(row => {
            out += `<div class="pred-row"><div class="pred-scenario">${row.scenario}</div><div class="pred-prob">${row.prob}</div><div>${row.reason}</div></div>`;
          });
          out += `</div>`;
        }
        
        if (article.fullText && article.fullText.trim() !== "") {
          const expandId = 'expand_' + Math.random().toString(36).substr(2, 9);
          
          out += `<div class="action-btn-group">`;
          out += `<button class="article-expand-btn" style="flex: 1; margin-top: 0;" onclick="const e = document.getElementById('${expandId}'); if(e.style.display==='block'){e.style.display='none';this.innerText='READ FULL SYNTHESIS';}else{e.style.display='block';this.innerText='COLLAPSE SYNTHESIS';}">READ FULL SYNTHESIS</button>`;
          
          if (article.sourceUrl && article.sourceUrl.startsWith('http')) {
              out += `<a href="${article.sourceUrl}" target="_blank" class="article-expand-btn" style="flex: 1; margin-top: 0; text-decoration: none; color: var(--gold-bright); border-color: var(--gold-primary);">VIEW ORIGINAL SOURCE</a>`;
          }
          out += `</div>`;
          
          out += `<div id="${expandId}" class="article-full-text">${article.fullText.replace(/\n/g, '<br>')}</div>`;
        }
        
        out += `</div>`;
        return out;
      }
      
      let i = 0;
      let currentSection = ""; // 'core', 'matrix', 'synthesis'
      let isHiddenSection = false;
      
      // Basic markdown replacer
      const mdFormat = (text) => text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
      
      while (i < lines.length) {
        let line = lines[i].trim();
        let lowerLine = line.toLowerCase();
        
        // Hide specific sections requested by operator (only for PDF)
        if (lowerLine.includes('intelligence gaps') || lowerLine.includes('actionable intelligence') || lowerLine.includes('issues with the report') || lowerLine.includes('recommendations')) {
            isHiddenSection = true;
            if (inArticle) { html += renderArticle(); inArticle = false; }
            i++; continue;
        }
        
        if (line.startsWith('## ') && !line.startsWith('### ')) {
          isHiddenSection = false;
          if (inArticle) { html += renderArticle(); inArticle = false; }
          html += `<div class="topic-header">${line.replace('## ', '')}</div>`;
          i++; continue;
        }
        
        if (line.startsWith('### ')) {
          isHiddenSection = false;
          if (inArticle) { html += renderArticle(); }
          inArticle = true;
          article = {
            title: line.replace('### ', '').replace(/\*\*/g, ''),
            relScore: '', relBluf: '', bluf: '', sourceUrl: '',
            eventTime: '', projectedEnd: '', endReason: '',
            coreIntel: [], matrix: [], fullText: ''
          };
          currentSection = "";
          i++; continue;
        }
        
        if (isHiddenSection) {
            i++; continue;
        }
        
        if (inArticle) {
          if (line === '***' || line === '---') {
            i++; continue;
          }
          
          if (lowerLine.includes('reliability score')) {
            article.relScore = line.split(':').slice(1).join(':').trim().replace(/\*\*/g, '');
          } else if (lowerLine.includes('reliability bluf')) {
            article.relBluf = mdFormat(line.split(':').slice(1).join(':').trim());
          } else if (lowerLine.includes('article bluf') || (lowerLine.includes('bluf:') && !article.bluf)) {
            article.bluf = mdFormat(line.split(':').slice(1).join(':').trim());
          } else if (lowerLine.includes('event date') || lowerLine.includes('event time') || lowerLine.includes('occurred at')) {
            article.eventTime = line.split(':').slice(1).join(':').trim().replace(/\*\*/g, '');
          } else if (lowerLine.includes('projected end') || lowerLine.includes('expected end')) {
            article.projectedEnd = line.split(':').slice(1).join(':').trim().replace(/\*\*/g, '');
          } else if (lowerLine.includes('end reason') || lowerLine.includes('ongoing reason')) {
            article.endReason = line.split(':').slice(1).join(':').trim().replace(/\*\*/g, '');
          } else if (lowerLine.includes('source url')) {
            let urlMatch = line.match(/(https?:\/\/[^\s\]\)]+)/);
            if (urlMatch) {
                article.sourceUrl = urlMatch[1];
            } else {
                let textUrl = line.split(':').slice(1).join(':').trim().replace(/[\[\]\*]/g, '');
                if (textUrl.startsWith('http')) article.sourceUrl = textUrl;
            }
          } else if (lowerLine.includes('core intelligence')) {
            currentSection = "core";
          } else if (lowerLine.includes('predictive matrix')) {
            currentSection = "matrix";
          } else if (lowerLine.includes('complete synthesis')) {
            currentSection = "synthesis";
          } else if (line !== "") {
            // Inside a section
            if (currentSection === "core") {
              if (line.startsWith('-') || line.startsWith('*')) {
                article.coreIntel.push(mdFormat(line.substring(1).trim()));
              } else {
                article.coreIntel.push(mdFormat(line));
              }
            } else if (currentSection === "matrix") {
              if (line.includes('|') && !line.includes('---') && !lowerLine.includes('scenario |')) {
                let parts = line.split('|').map(s => s.trim());
                if (parts.length >= 3) {
                  article.matrix.push({ scenario: mdFormat(parts[0]), prob: mdFormat(parts[1]), reason: mdFormat(parts.slice(2).join(' | ')) });
                }
              }
            } else if (currentSection === "synthesis") {
              article.fullText += mdFormat(line) + "\n";
            } else {
              // If we are before any section but have random text, append to fullText
              if (!lowerLine.includes('reliability') && !lowerLine.includes('bluf') && 
                  !lowerLine.includes('event date') && !lowerLine.includes('event time') && !lowerLine.includes('occurred at') && 
                  !lowerLine.includes('projected end') && !lowerLine.includes('expected end') && 
                  !lowerLine.includes('end reason') && !lowerLine.includes('ongoing reason')) {
                  article.fullText += mdFormat(line) + "\n";
              }
            }
          }
        } else {
           // Not in an article and not a header. General preamble.
           if (line !== "") {
               html += `<div style="margin-bottom: 1rem; font-family: var(--font-body); color: var(--text-light);">${mdFormat(line)}</div>`;
           }
        }
        
        i++;
      }
      
      if (inArticle) { html += renderArticle(); }
      
      return html || "<div style='color: var(--crimson); padding: 2rem; text-align: center;'>REPORT PARSING FAILED.</div>";
    }
  
    function showReport(reportObj) {
      reportViewer.style.display = "block";
      reportDate.textContent = reportObj.date;
      
      let bodyText = reportObj.body || "Empty Report";
      
      // Parse structured text into HTML
      reportContent.innerHTML = parseReport(bodyText);
      
      if (reportObj.has_pdf) {
        pdfDownloadLink.style.display = "inline-block";
        pdfDownloadLink.href = reportObj.pdf_url;
      } else {
        pdfDownloadLink.style.display = "none";
      }
      
      // Scroll to report
      setTimeout(() => {
        reportViewer.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    }
  
    init();
  });
