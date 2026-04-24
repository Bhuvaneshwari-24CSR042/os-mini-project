const framesInput = document.getElementById('framesInput');
const referenceInput = document.getElementById('referenceInput');
const animationToggle = document.getElementById('animationToggle');
const speedInput = document.getElementById('speedInput');
const runBtn = document.getElementById('runBtn');
const compareBtn = document.getElementById('compareBtn');
const resetBtn = document.getElementById('resetBtn');
const exportCsvBtn = document.getElementById('exportCsvBtn');
const exportTxtBtn = document.getElementById('exportTxtBtn');
const frameBoxes = document.getElementById('frameBoxes');
const stepsTable = document.getElementById('stepsTable');
const stepsTableHead = document.getElementById('stepsTableHead');
const stepsTableBody = document.getElementById('stepsTableBody');
const explanationText = document.getElementById('explanationText');
const summaryTableBody = document.getElementById('summaryTableBody');
const bestAlgo = document.getElementById('bestAlgo');
const chartPlaceholder = document.getElementById('chartPlaceholder');
const comparisonHead = document.getElementById('comparisonHead');
const comparisonBody = document.getElementById('comparisonBody');

const state = {
  steps: [],
  lastResults: {},
  animationTimer: null
};

const algorithms = {
  FIFO: fifo,
  LRU: lru,
  Optimal: optimal
};

function getSelectedAlgorithm() {
  const selected = document.querySelector('input[name="algo"]:checked');
  return selected ? selected.value : 'FIFO';
}

function parseInputs() {
  const capacity = parseInt(framesInput.value, 10);
  if (!Number.isInteger(capacity) || capacity < 1 || capacity > 10) {
    throw new Error('Number of frames must be an integer between 1 and 10.');
  }

  const raw = referenceInput.value.trim();
  const pages = raw.split(',').map(value => value.trim()).filter(Boolean).map(Number);
  if (!pages.length || pages.some(page => Number.isNaN(page))) {
    throw new Error('Reference string must contain comma-separated integers.');
  }

  return { pages, capacity };
}

function runSimulation() {
  stopAnimation();
  let pages, capacity;
  try {
    ({ pages, capacity } = parseInputs());
  } catch (error) {
    alert(error.message);
    return;
  }
  const algorithm = getSelectedAlgorithm();
  const [steps, faults, hits] = algorithms[algorithm](pages, capacity);
  state.steps = steps;
  state.lastResults = { [algorithm]: { steps, faults, hits } };

  rebuildStepsTableHeader(capacity);
  clearStepsTable();
  renderSummarySingle(algorithm, faults, hits, pages.length);
  updateComparisonPlaceholder(pages);

  if (animationToggle.checked) {
    animateSteps(0, capacity);
  } else {
    renderStepRows(steps, capacity);
    if (steps.length) {
      renderFrameBoxes(steps[steps.length - 1].frames, capacity);
      explanationText.textContent = steps[steps.length - 1].explanation;
    }
  }
}

function stopAnimation() {
  if (state.animationTimer) {
    clearTimeout(state.animationTimer);
    state.animationTimer = null;
  }
}

function animateSteps(index, capacity) {
  if (index >= state.steps.length) {
    return;
  }
  const step = state.steps[index];
  const row = createRow(step, capacity);
  stepsTableBody.appendChild(row);
  renderFrameBoxes(step.frames, capacity, step.page, step.replaced);
  explanationText.textContent = `Step ${step.step}: ${step.explanation}`;
  state.animationTimer = setTimeout(() => animateSteps(index + 1, capacity), Number(speedInput.value));
}

function rebuildStepsTableHeader(capacity) {
  const columns = ['Step', 'Current Page'];
  for (let i = 1; i <= capacity; i += 1) {
    columns.push(`Frame ${i}`);
  }
  columns.push('Result', 'Replaced', 'Explanation');
  const headerRow = columns.map(text => `<th>${text}</th>`).join('');
  stepsTableHead.innerHTML = `<tr>${headerRow}</tr>`;
}

function clearStepsTable() {
  stepsTableBody.innerHTML = '';
}

function renderStepRows(steps, capacity) {
  clearStepsTable();
  steps.forEach(step => {
    const row = createRow(step, capacity);
    stepsTableBody.appendChild(row);
  });
}

function createRow(step, capacity) {
  const cells = [step.step, step.page, ...step.frames, ...Array(capacity - step.frames.length).fill('-'), step.result, step.replaced, step.explanation];
  const row = document.createElement('tr');
  row.className = step.result === 'Hit' ? 'hit-row' : 'fault-row';
  cells.forEach(value => {
    const cell = document.createElement('td');
    cell.textContent = value;
    row.appendChild(cell);
  });
  return row;
}

function renderFrameBoxes(frames, capacity, currentPage = null, replacedPage = null) {
  frameBoxes.innerHTML = '';
  for (let index = 0; index < capacity; index += 1) {
    const value = index < frames.length ? frames[index] : '-';
    const box = document.createElement('div');
    box.className = 'frame-box';
    if (currentPage !== null && value === currentPage && value !== '-') {
      box.classList.add('frame-box-current');
    } else if (replacedPage !== null && value === replacedPage && value !== '-') {
      box.classList.add('frame-box-replaced');
    }
    box.innerHTML = `<span>Frame ${index + 1}</span><strong>${value}</strong>`;
    frameBoxes.appendChild(box);
  }
}

function renderSummarySingle(algorithm, faults, hits, total) {
  summaryTableBody.innerHTML = '';
  const ratio = total ? (hits / total) : 0;
  const row = document.createElement('tr');
  row.innerHTML = `<td>${algorithm}</td><td>${faults}</td><td>${(ratio * 100).toFixed(2)}%</td>`;
  summaryTableBody.appendChild(row);
  bestAlgo.textContent = `Best Algorithm: ${algorithm} (only one run)`;
  renderPerformanceChart([{ name: algorithm, faults }], algorithm);
}

function compareAll() {
  stopAnimation();
  let pages, capacity;
  try {
    ({ pages, capacity } = parseInputs());
  } catch (error) {
    alert(error.message);
    return;
  }

  const results = Object.entries(algorithms).reduce((acc, [name, fn]) => {
    const [steps, faults, hits] = fn(pages, capacity);
    acc[name] = { steps, faults, hits };
    return acc;
  }, {});

  state.lastResults = results;
  const total = pages.length;
  let bestName = null;
  let bestFaults = Infinity;

  summaryTableBody.innerHTML = '';
  Object.entries(results).forEach(([name, result]) => {
    const ratio = total ? (result.hits / total) : 0;
    const row = document.createElement('tr');
    row.innerHTML = `<td>${name}</td><td>${result.faults}</td><td>${(ratio * 100).toFixed(2)}%</td>`;
    if (result.faults < bestFaults) {
      bestFaults = result.faults;
      bestName = name;
    }
    summaryTableBody.appendChild(row);
  });

  bestAlgo.textContent = `Best Algorithm: ${bestName} (${bestFaults} faults)`;
  renderPerformanceChart(Object.entries(results).map(([name, result]) => ({ name, faults: result.faults })), bestName);
  renderComparisonTable(pages, results);

  const selected = getSelectedAlgorithm();
  const selectedResult = results[selected];
  if (selectedResult) {
    rebuildStepsTableHeader(capacity);
    renderStepRows(selectedResult.steps, capacity);
    if (selectedResult.steps.length) {
      renderFrameBoxes(selectedResult.steps[selectedResult.steps.length - 1].frames, capacity);
      explanationText.textContent = `Showing ${selected} steps. Compare totals on the right.`;
    }
  }
}

function renderComparisonTable(pages, results) {
  const columns = ['Algorithm', ...pages.map(String), 'Total Faults'];
  const headerRow = columns.map(text => `<th>${text}</th>`).join('');
  comparisonHead.innerHTML = `<tr>${headerRow}</tr>`;
  comparisonBody.innerHTML = '';

  Object.entries(results).forEach(([name, result]) => {
    const cells = [name, ...result.steps.map(step => step.result === 'Hit' ? 'H' : 'F'), result.faults];
    const row = document.createElement('tr');
    row.innerHTML = cells.map(value => `<td>${value}</td>`).join('');
    comparisonBody.appendChild(row);
  });
}

function renderPerformanceChart(bars, highlightName) {
  const maxFaults = Math.max(...bars.map(item => item.faults), 1);
  chartPlaceholder.innerHTML = bars.map(item => {
    const width = Math.round((item.faults / maxFaults) * 100);
    const highlight = item.name === highlightName ? ' chart-bar-highlight' : '';
    return `
      <div class="chart-row">
        <span>${item.name}</span>
        <div class="chart-bar${highlight}">
          <div class="chart-bar-fill" style="width:${width}%"></div>
        </div>
        <strong>${item.faults}</strong>
      </div>`;
  }).join('');
}

function updateComparisonPlaceholder(pages) {
  comparisonHead.innerHTML = '<tr><th>Algorithm</th>' + pages.map(page => `<th>${page}</th>`).join('') + '<th>Total Faults</th></tr>';
  comparisonBody.innerHTML = '';
}

function resetAll() {
  stopAnimation();
  framesInput.value = '3';
  referenceInput.value = '';
  document.querySelector('input[name="algo"][value="FIFO"]').checked = true;
  animationToggle.checked = true;
  speedInput.value = '600';
  clearStepsTable();
  summaryTableBody.innerHTML = '';
  comparisonHead.innerHTML = '<tr><th>Algorithm</th><th>7</th><th>0</th><th>1</th><th>2</th><th>0</th><th>Total Faults</th></tr>';
  comparisonBody.innerHTML = '';
  bestAlgo.textContent = 'Best Algorithm: —';
  chartPlaceholder.textContent = 'Bar chart area';
  explanationText.textContent = 'Cleared. Enter inputs and run a simulation.';
  renderFrameBoxes([], 3);
  state.steps = [];
  state.lastResults = {};
}

function exportCsv() {
  if (!state.steps.length) {
    alert('Run a simulation first.');
    return;
  }
  const rows = [ ['Step','Page','Frames','Result','Replaced','Explanation'], ...state.steps.map(step => [step.step, step.page, step.frames.join(' '), step.result, step.replaced, step.explanation]) ];
  const csv = rows.map(row => row.map(value => `"${String(value).replace(/"/g, '""')}"`).join(',')).join('\n');
  downloadFile(csv, 'simulation.csv', 'text/csv;charset=utf-8;');
}

function exportTxt() {
  if (!state.steps.length) {
    alert('Run a simulation first.');
    return;
  }
  const lines = ['Page Replacement Simulation Results', '------------------------------------------------------------', ''];
  state.steps.forEach(step => {
    lines.push(`Step ${step.step} | Page ${step.page} | Frames: [${step.frames.join(', ')}] | ${step.result} | Replaced: ${step.replaced}`);
    lines.push(`  -> ${step.explanation}`);
  });
  const summaryRows = Object.entries(state.lastResults).map(([name, result]) => {
    const total = result.faults + result.hits;
    const ratio = total ? (result.hits / total) : 0;
    return `${name}: faults=${result.faults}, hits=${result.hits}, hit_ratio=${(ratio * 100).toFixed(2)}%`;
  });
  if (summaryRows.length) {
    lines.push('', 'Summary', '------------------------------------------------------------', ...summaryRows);
  }
  downloadFile(lines.join('\n'), 'simulation.txt', 'text/plain;charset=utf-8;');
}

function downloadFile(content, filename, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

function fifo(pages, capacity) {
  const frames = [];
  const queue = [];
  const steps = [];
  let faults = 0;
  let hits = 0;

  pages.forEach((page, index) => {
    let replaced = '-';
    let explanation = '';
    let result;

    if (frames.includes(page)) {
      hits += 1;
      result = 'Hit';
      explanation = `Page ${page} found in frames -> Hit`;
    } else {
      faults += 1;
      result = 'Fault';
      if (frames.length < capacity) {
        frames.push(page);
        explanation = `Page ${page} loaded into empty frame (Fault)`;
      } else {
        replaced = queue.shift();
        const idx = frames.indexOf(replaced);
        frames[idx] = page;
        explanation = `Page ${page} caused fault, replaced Page ${replaced} using FIFO`;
      }
      queue.push(page);
    }

    steps.push({
      step: index + 1,
      page,
      frames: [...frames],
      result,
      replaced,
      explanation
    });
  });

  return [steps, faults, hits];
}

function lru(pages, capacity) {
  const frames = [];
  const recent = [];
  const steps = [];
  let faults = 0;
  let hits = 0;

  pages.forEach((page, index) => {
    let replaced = '-';
    let explanation = '';
    let result;

    if (frames.includes(page)) {
      hits += 1;
      result = 'Hit';
      recent.splice(recent.indexOf(page), 1);
      recent.push(page);
      explanation = `Page ${page} found -> Hit (marked most recent)`;
    } else {
      faults += 1;
      result = 'Fault';
      if (frames.length < capacity) {
        frames.push(page);
        explanation = `Page ${page} loaded into empty frame (Fault)`;
      } else {
        replaced = recent.shift();
        const idx = frames.indexOf(replaced);
        frames[idx] = page;
        explanation = `Page ${page} caused fault, replaced LRU page ${replaced}`;
      }
      recent.push(page);
    }

    steps.push({
      step: index + 1,
      page,
      frames: [...frames],
      result,
      replaced,
      explanation
    });
  });

  return [steps, faults, hits];
}

function optimal(pages, capacity) {
  const frames = [];
  const steps = [];
  let faults = 0;
  let hits = 0;

  pages.forEach((page, index) => {
    let replaced = '-';
    let explanation = '';
    let result;

    if (frames.includes(page)) {
      hits += 1;
      result = 'Hit';
      explanation = `Page ${page} found -> Hit`;
    } else {
      faults += 1;
      result = 'Fault';
      if (frames.length < capacity) {
        frames.push(page);
        explanation = `Page ${page} loaded into empty frame (Fault)`;
      } else {
        const future = pages.slice(index + 1);
        let victim = frames[0];
        let farthest = -1;

        frames.forEach(candidate => {
          const nextIndex = future.indexOf(candidate);
          if (nextIndex === -1) {
            victim = candidate;
            farthest = Infinity;
          } else if (nextIndex > farthest) {
            farthest = nextIndex;
            victim = candidate;
          }
        });

        replaced = victim;
        const idx = frames.indexOf(victim);
        frames[idx] = page;
        explanation = `Page ${page} replaced Page ${victim} (used farthest in future)`;
      }
    }

    steps.push({
      step: index + 1,
      page,
      frames: [...frames],
      result,
      replaced,
      explanation
    });
  });

  return [steps, faults, hits];
}

runBtn.addEventListener('click', runSimulation);
compareBtn.addEventListener('click', compareAll);
resetBtn.addEventListener('click', resetAll);
exportCsvBtn.addEventListener('click', exportCsv);
exportTxtBtn.addEventListener('click', exportTxt);

resetAll();
