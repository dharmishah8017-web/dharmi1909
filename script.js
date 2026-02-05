// Simple scientific calculator logic
(() => {
  const displayEl = document.getElementById('display');
  const historyEl = document.getElementById('history');
  const degRadBtn = document.getElementById('degRadBtn');
  const memIndicator = document.getElementById('memIndicator');

  let expr = '';
  let lastAns = null;
  let memory = 0;
  let angleMode = 'DEG'; // 'DEG' or 'RAD'

  // Allowed names for safety check
  const ALLOWED_FUNCS = new Set([
    'sin','cos','tan','asin','acos','atan',
    'sqrt','log','ln','exp','pow','fact'
  ]);
  const ALLOWED_CONSTS = new Set(['pi','e','ans']);

  function updateDisplay() {
    displayEl.textContent = expr || '0';
    memIndicator.style.opacity = memory !== 0 ? '1' : '0.25';
  }

  function append(value) {
    expr += value;
    updateDisplay();
  }

  function clearAll() {
    expr = '';
    updateDisplay();
    historyEl.textContent = '';
  }

  function del() {
    expr = expr.slice(0, -1);
    updateDisplay();
  }

  function toggleSign() {
    // attempt to toggle last number sign
    // find last number token
    const match = expr.match(/([+\-*/^(]|^)(\d+(\.\d+)?)$/);
    if (match) {
      const num = match[2];
      const start = match.index + match[1].length;
      const before = expr.slice(0, start);
      if (before.endsWith('-')) {
        // convert a-b to a+b
        expr = before.slice(0, -1) + '+' + expr.slice(start + num.length);
      } else {
        expr = before + '(-' + num + ')' + expr.slice(start + num.length);
      }
    } else {
      // if nothing, maybe just prefix negative
      if (!expr) expr = '(-)';
    }
    updateDisplay();
  }

  function insertConstant(name) {
    if (name === 'pi') append('pi');
    else if (name === 'e') append('e');
  }

  function pressFunction(fnName) {
    switch (fnName) {
      case 'sqrt': append('sqrt('); break;
      case 'fact': append('!'); break; // handled in parser
      case 'pow2': append('^2'); break;
      case 'pow3': append('^3'); break;
      case 'ln': append('ln('); break;
      case 'log': append('log('); break;
      case 'exp': append('exp('); break;
      case 'sin': append('sin('); break;
      case 'cos': append('cos('); break;
      case 'tan': append('tan('); break;
      case 'asin': append('asin('); break;
      case 'acos': append('acos('); break;
      case 'atan': append('atan('); break;
      case 'percent': append('%'); break;
      default: break;
    }
  }

  function setDegRad(mode) {
    angleMode = mode;
    degRadBtn.textContent = angleMode;
    degRadBtn.classList.toggle('active', angleMode === 'DEG');
  }

  degRadBtn.addEventListener('click', () => {
    setDegRad(angleMode === 'DEG' ? 'RAD' : 'DEG');
  });

  // Buttons handling
  document.querySelectorAll('.buttons button').forEach(btn => {
    btn.addEventListener('click', () => {
      const insert = btn.dataset.insert;
      const action = btn.dataset.action;
      const fn = btn.dataset.fn;

      if (insert) {
        append(insert);
      } else if (action) {
        if (action === 'clear') clearAll();
        else if (action === 'del') del();
        else if (action === 'equals') evaluate();
        else if (action === 'neg') toggleSign();
      } else if (fn) {
        // memory functions
        if (fn === 'mc') { memory = 0; memIndicator.style.opacity = '0.25'; }
        else if (fn === 'mr') { expr += (memory + ''); updateDisplay(); }
        else if (fn === 'mplus') { evaluate(true); memory += lastAns || 0; }
        else if (fn === 'mminus') { evaluate(true); memory -= lastAns || 0; }
        else pressFunction(fn);
      }
    });
  });

  // keyboard support
  window.addEventListener('keydown', (ev) => {
    if (ev.key >= '0' && ev.key <= '9') append(ev.key);
    else if (ev.key === '.') append('.');
    else if (ev.key === 'Enter' || ev.key === '=') { ev.preventDefault(); evaluate(); }
    else if (ev.key === 'Backspace') del();
    else if (ev.key === 'Escape') clearAll();
    else if (ev.key === '+' || ev.key === '-' || ev.key === '*' || ev.key === '/') append(ev.key);
    else if (ev.key === '^') append('^');
    else if (ev.key === '(' || ev.key === ')') append(ev.key);
  });

  // Utilities for evaluation
  function factorial(n) {
    if (n < 0) throw new Error('Factorial of negative number');
    if (n > 170) throw new Error('Value too large'); // avoid Infinity
    if (Math.floor(n) !== n) throw new Error('Factorial only integer');
    let r = 1;
    for (let i = 2; i <= n; i++) r *= i;
    return r;
  }

  function safeEvaluate(input) {
    if (!input || input.trim() === '') return 0;

    // preprocessing: replace Unicode operators
    let s = input.replace(/×/g, '*').replace(/÷/g, '/');

    // replace percentage: number% -> (number/100)
    s = s.replace(/(\d+(\.\d+)?)%/g, '($1/100)');

    // convert postfix factorial: number! or (expr)! => fact(number)
    // handle simple cases: number! and (...)!
    s = s.replace(/(\d+(\.\d+)?|\([^()]*\))!/g, 'fact($1)');

    // replace ^ with pow(a,b) notation: a^b -> pow(a,b)
    // We convert from infix ^ to function calls using a simple loop to catch a^b patterns
    // This is a simple approach and won't handle nested complex edge cases but works for standard uses.
    while (s.includes('^')) {
      s =
