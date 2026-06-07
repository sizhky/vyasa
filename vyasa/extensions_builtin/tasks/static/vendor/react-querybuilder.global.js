var VyasaTasksQueryBuilderBundle = (() => {
  var __create = Object.create;
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __getProtoOf = Object.getPrototypeOf;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __esm = (fn, res) => function __init() {
    return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
  };
  var __commonJS = (cb, mod) => function __require() {
    return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
  };
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
    // If the importer is in node compatibility mode or this is not an ESM
    // file that has been converted to a CommonJS file using a Babel-
    // compatible transform (i.e. "__esModule" has not been set), then set
    // "default" to the CommonJS "module.exports" for node compatibility.
    isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
    mod
  ));
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // src/react-global-shim.js
  var react_global_shim_exports = {};
  __export(react_global_shim_exports, {
    Children: () => Children,
    Component: () => Component,
    Fragment: () => Fragment,
    Profiler: () => Profiler,
    PureComponent: () => PureComponent,
    StrictMode: () => StrictMode,
    Suspense: () => Suspense,
    cloneElement: () => cloneElement,
    createContext: () => createContext,
    createElement: () => createElement,
    createRef: () => createRef,
    default: () => react_global_shim_default,
    forwardRef: () => forwardRef,
    isValidElement: () => isValidElement,
    lazy: () => lazy,
    memo: () => memo,
    startTransition: () => startTransition,
    useCallback: () => useCallback,
    useContext: () => useContext,
    useDebugValue: () => useDebugValue,
    useDeferredValue: () => useDeferredValue,
    useEffect: () => useEffect,
    useId: () => useId,
    useImperativeHandle: () => useImperativeHandle,
    useInsertionEffect: () => useInsertionEffect,
    useLayoutEffect: () => useLayoutEffect,
    useMemo: () => useMemo,
    useReducer: () => useReducer,
    useRef: () => useRef,
    useState: () => useState,
    useSyncExternalStore: () => useSyncExternalStore,
    useTransition: () => useTransition,
    version: () => version
  });
  var React, react_global_shim_default, Children, Component, Fragment, Profiler, PureComponent, StrictMode, Suspense, cloneElement, createContext, createElement, createRef, forwardRef, isValidElement, lazy, memo, startTransition, useCallback, useContext, useDebugValue, useDeferredValue, useEffect, useId, useImperativeHandle, useInsertionEffect, useLayoutEffect, useMemo, useReducer, useRef, useState, useSyncExternalStore, useTransition, version;
  var init_react_global_shim = __esm({
    "src/react-global-shim.js"() {
      React = window.React;
      react_global_shim_default = React;
      Children = React.Children;
      Component = React.Component;
      Fragment = React.Fragment;
      Profiler = React.Profiler;
      PureComponent = React.PureComponent;
      StrictMode = React.StrictMode;
      Suspense = React.Suspense;
      cloneElement = React.cloneElement;
      createContext = React.createContext;
      createElement = React.createElement;
      createRef = React.createRef;
      forwardRef = React.forwardRef;
      isValidElement = React.isValidElement;
      lazy = React.lazy;
      memo = React.memo;
      startTransition = React.startTransition;
      useCallback = React.useCallback;
      useContext = React.useContext;
      useDebugValue = React.useDebugValue;
      useDeferredValue = React.useDeferredValue;
      useEffect = React.useEffect;
      useId = React.useId;
      useImperativeHandle = React.useImperativeHandle;
      useInsertionEffect = React.useInsertionEffect;
      useLayoutEffect = React.useLayoutEffect;
      useMemo = React.useMemo;
      useReducer = React.useReducer;
      useRef = React.useRef;
      useState = React.useState;
      useSyncExternalStore = React.useSyncExternalStore;
      useTransition = React.useTransition;
      version = React.version;
    }
  });

  // node_modules/use-sync-external-store/cjs/use-sync-external-store-with-selector.production.js
  var require_use_sync_external_store_with_selector_production = __commonJS({
    "node_modules/use-sync-external-store/cjs/use-sync-external-store-with-selector.production.js"(exports) {
      "use strict";
      var React2 = (init_react_global_shim(), __toCommonJS(react_global_shim_exports));
      function is2(x, y) {
        return x === y && (0 !== x || 1 / x === 1 / y) || x !== x && y !== y;
      }
      var objectIs = "function" === typeof Object.is ? Object.is : is2;
      var useSyncExternalStore2 = React2.useSyncExternalStore;
      var useRef2 = React2.useRef;
      var useEffect2 = React2.useEffect;
      var useMemo2 = React2.useMemo;
      var useDebugValue2 = React2.useDebugValue;
      exports.useSyncExternalStoreWithSelector = function(subscribe, getSnapshot, getServerSnapshot, selector, isEqual) {
        var instRef = useRef2(null);
        if (null === instRef.current) {
          var inst = { hasValue: false, value: null };
          instRef.current = inst;
        } else inst = instRef.current;
        instRef = useMemo2(
          function() {
            function memoizedSelector(nextSnapshot) {
              if (!hasMemo) {
                hasMemo = true;
                memoizedSnapshot = nextSnapshot;
                nextSnapshot = selector(nextSnapshot);
                if (void 0 !== isEqual && inst.hasValue) {
                  var currentSelection = inst.value;
                  if (isEqual(currentSelection, nextSnapshot))
                    return memoizedSelection = currentSelection;
                }
                return memoizedSelection = nextSnapshot;
              }
              currentSelection = memoizedSelection;
              if (objectIs(memoizedSnapshot, nextSnapshot)) return currentSelection;
              var nextSelection = selector(nextSnapshot);
              if (void 0 !== isEqual && isEqual(currentSelection, nextSelection))
                return memoizedSnapshot = nextSnapshot, currentSelection;
              memoizedSnapshot = nextSnapshot;
              return memoizedSelection = nextSelection;
            }
            var hasMemo = false, memoizedSnapshot, memoizedSelection, maybeGetServerSnapshot = void 0 === getServerSnapshot ? null : getServerSnapshot;
            return [
              function() {
                return memoizedSelector(getSnapshot());
              },
              null === maybeGetServerSnapshot ? void 0 : function() {
                return memoizedSelector(maybeGetServerSnapshot());
              }
            ];
          },
          [getSnapshot, getServerSnapshot, selector, isEqual]
        );
        var value = useSyncExternalStore2(subscribe, instRef[0], instRef[1]);
        useEffect2(
          function() {
            inst.hasValue = true;
            inst.value = value;
          },
          [value]
        );
        useDebugValue2(value);
        return value;
      };
    }
  });

  // node_modules/use-sync-external-store/with-selector.js
  var require_with_selector = __commonJS({
    "node_modules/use-sync-external-store/with-selector.js"(exports, module) {
      "use strict";
      if (true) {
        module.exports = require_use_sync_external_store_with_selector_production();
      } else {
        module.exports = null;
      }
    }
  });

  // node_modules/numeric-quantity/dist/numeric-quantity.mjs
  var decimalDigitBlockStarts = [
    48,
    1632,
    1776,
    1984,
    2406,
    2534,
    2662,
    2790,
    2918,
    3046,
    3174,
    3302,
    3430,
    3558,
    3664,
    3792,
    3872,
    4160,
    4240,
    6112,
    6160,
    6470,
    6608,
    6784,
    6800,
    6992,
    7088,
    7232,
    7248,
    42528,
    43216,
    43264,
    43472,
    43504,
    43600,
    44016,
    65296,
    66720,
    68912,
    68928,
    69734,
    69872,
    69942,
    70096,
    70384,
    70736,
    70864,
    71248,
    71360,
    71376,
    71386,
    71472,
    71904,
    72016,
    72688,
    72784,
    73040,
    73120,
    73184,
    73552,
    90416,
    92768,
    92864,
    93008,
    93552,
    118e3,
    120782,
    120792,
    120802,
    120812,
    120822,
    123200,
    123632,
    124144,
    124401,
    125264,
    130032
  ];
  var normalizeDigits = (str) => str.replace(/\p{Nd}/gu, (ch) => {
    const cp = ch.codePointAt(0);
    if (cp <= 57) return ch;
    let lo = 0;
    let hi = decimalDigitBlockStarts.length - 1;
    while (lo < hi) {
      const mid = lo + hi + 1 >>> 1;
      if (decimalDigitBlockStarts[mid] <= cp) lo = mid;
      else hi = mid - 1;
    }
    return String(cp - decimalDigitBlockStarts[lo]);
  });
  var superSubDigitToAsciiMap = {
    "\u2070": "0",
    "\xB9": "1",
    "\xB2": "2",
    "\xB3": "3",
    "\u2074": "4",
    "\u2075": "5",
    "\u2076": "6",
    "\u2077": "7",
    "\u2078": "8",
    "\u2079": "9",
    "\u2080": "0",
    "\u2081": "1",
    "\u2082": "2",
    "\u2083": "3",
    "\u2084": "4",
    "\u2085": "5",
    "\u2086": "6",
    "\u2087": "7",
    "\u2088": "8",
    "\u2089": "9"
  };
  var superSubDigitsRegex = /[⁰¹²³⁴⁵⁶⁷⁸⁹₀₁₂₃₄₅₆₇₈₉]/g;
  var vulgarFractionToAsciiMap = {
    "\xBC": "1/4",
    "\xBD": "1/2",
    "\xBE": "3/4",
    "\u2150": "1/7",
    "\u2151": "1/9",
    "\u2152": "1/10",
    "\u2153": "1/3",
    "\u2154": "2/3",
    "\u2155": "1/5",
    "\u2156": "2/5",
    "\u2157": "3/5",
    "\u2158": "4/5",
    "\u2159": "1/6",
    "\u215A": "5/6",
    "\u215B": "1/8",
    "\u215C": "3/8",
    "\u215D": "5/8",
    "\u215E": "7/8",
    "\u215F": "1/"
  };
  var numericRegex = /^(?=[-+]?\s*\.\d|[-+]?\s*\d)([-+])?\s*((?:\d(?:[,_]\d|\d)*)*)(([eE][+-]?\d(?:[,_]\d|\d)*)?|\.\d(?:[,_]\d|\d)*([eE][+-]?\d(?:[,_]\d|\d)*)?|(\s+\d(?:[,_]\d|\d)*\s*)?\s*\/\s*\d(?:[,_]\d|\d)*)?$/;
  var numericRegexWithTrailingInvalid = /^(?=[-+]?\s*\.\d|[-+]?\s*\d)([-+])?\s*((?:\d(?:[,_]\d|\d)*)*)(([eE][+-]?\d(?:[,_]\d|\d)*)?|\.\d(?:[,_]\d|\d)*([eE][+-]?\d(?:[,_]\d|\d)*)?|(\s+\d(?:[,_]\d|\d)*\s*)?\s*\/\s*\d(?:[,_]\d|\d)*)?(\s*[^.\d/].*)?/;
  var vulgarFractionsRegex = /([¼½¾⅐⅑⅒⅓⅔⅕⅖⅗⅘⅙⅚⅛⅜⅝⅞⅟}])/g;
  var romanNumeralValues = {
    MMM: 3e3,
    MM: 2e3,
    M: 1e3,
    CM: 900,
    DCCC: 800,
    DCC: 700,
    DC: 600,
    D: 500,
    CD: 400,
    CCC: 300,
    CC: 200,
    C: 100,
    XC: 90,
    LXXX: 80,
    LXX: 70,
    LX: 60,
    L: 50,
    XL: 40,
    XXX: 30,
    XX: 20,
    XII: 12,
    XI: 11,
    X: 10,
    IX: 9,
    VIII: 8,
    VII: 7,
    VI: 6,
    V: 5,
    IV: 4,
    III: 3,
    II: 2,
    I: 1
  };
  var romanNumeralUnicodeToAsciiMap = {
    "\u2160": "I",
    "\u2161": "II",
    "\u2162": "III",
    "\u2163": "IV",
    "\u2164": "V",
    "\u2165": "VI",
    "\u2166": "VII",
    "\u2167": "VIII",
    "\u2168": "IX",
    "\u2169": "X",
    "\u216A": "XI",
    "\u216B": "XII",
    "\u216C": "L",
    "\u216D": "C",
    "\u216E": "D",
    "\u216F": "M",
    "\u2170": "I",
    "\u2171": "II",
    "\u2172": "III",
    "\u2173": "IV",
    "\u2174": "V",
    "\u2175": "VI",
    "\u2176": "VII",
    "\u2177": "VIII",
    "\u2178": "IX",
    "\u2179": "X",
    "\u217A": "XI",
    "\u217B": "XII",
    "\u217C": "L",
    "\u217D": "C",
    "\u217E": "D",
    "\u217F": "M"
  };
  var romanNumeralUnicodeRegex = /([ⅠⅡⅢⅣⅤⅥⅦⅧⅨⅩⅪⅫⅬⅭⅮⅯⅰⅱⅲⅳⅴⅵⅶⅷⅸⅹⅺⅻⅼⅽⅾⅿ])/gi;
  var romanNumeralRegex = /^(?=[MDCLXVI])(M{0,3})(C[MD]|D?C{0,3})(X[CL]|L?X{0,3})(I[XV]|V?I{0,3})$/i;
  var defaultOptions = {
    round: 3,
    allowTrailingInvalid: false,
    romanNumerals: false,
    bigIntOnOverflow: false,
    decimalSeparator: ".",
    allowCurrency: false,
    percentage: false,
    verbose: false
  };
  var parseRomanNumerals = (romanNumerals) => {
    const normalized = `${romanNumerals}`.replace(romanNumeralUnicodeRegex, (_m, rn) => romanNumeralUnicodeToAsciiMap[rn]).toUpperCase();
    const regexResult = romanNumeralRegex.exec(normalized);
    if (!regexResult) return NaN;
    const [, thousands, hundreds, tens, ones] = regexResult;
    return (romanNumeralValues[thousands] ?? 0) + (romanNumeralValues[hundreds] ?? 0) + (romanNumeralValues[tens] ?? 0) + (romanNumeralValues[ones] ?? 0);
  };
  var spaceThenSlashRegex = /^\s*\//;
  var currencyPrefixRegex = /^([-+]?)\s*(\p{Sc}+)\s*/u;
  var currencySuffixRegex = /\s*(\p{Sc}+)$/u;
  var percentageSuffixRegex = /%$/;
  function numericQuantity(quantity, options = defaultOptions) {
    const opts = {
      ...defaultOptions,
      ...options
    };
    const originalInput = typeof quantity === "string" ? quantity : `${quantity}`;
    let currencyPrefix;
    let currencySuffix;
    let percentageSuffix;
    let trailingInvalid;
    let parsedSign;
    let parsedWhole;
    let parsedNumerator;
    let parsedDenominator;
    const buildVerboseResult = (value) => {
      const result = {
        value,
        input: originalInput
      };
      if (currencyPrefix) result.currencyPrefix = currencyPrefix;
      if (currencySuffix) result.currencySuffix = currencySuffix;
      if (percentageSuffix) result.percentageSuffix = percentageSuffix;
      if (trailingInvalid) result.trailingInvalid = trailingInvalid;
      if (parsedSign) result.sign = parsedSign;
      if (parsedWhole !== void 0) result.whole = parsedWhole;
      if (parsedNumerator !== void 0) result.numerator = parsedNumerator;
      if (parsedDenominator !== void 0) result.denominator = parsedDenominator;
      return result;
    };
    const returnValue = (value) => opts.verbose ? buildVerboseResult(value) : value;
    if (typeof quantity === "number" || typeof quantity === "bigint") return returnValue(quantity);
    let finalResult = NaN;
    let workingString = originalInput;
    if (opts.allowCurrency) {
      const prefixMatch = currencyPrefixRegex.exec(workingString);
      if (prefixMatch && prefixMatch[2]) {
        currencyPrefix = prefixMatch[2];
        workingString = (prefixMatch[1] || "") + workingString.slice(prefixMatch[0].length);
      }
    }
    if (opts.allowCurrency) {
      const suffixMatch = currencySuffixRegex.exec(workingString);
      if (suffixMatch) {
        currencySuffix = suffixMatch[1];
        workingString = workingString.slice(0, -suffixMatch[0].length);
      }
    }
    if (opts.percentage && percentageSuffixRegex.test(workingString)) {
      percentageSuffix = true;
      workingString = workingString.slice(0, -1);
    }
    const quantityAsString = normalizeDigits(workingString.replace(vulgarFractionsRegex, (_m, vf) => ` ${vulgarFractionToAsciiMap[vf]}`).replace(superSubDigitsRegex, (ch) => superSubDigitToAsciiMap[ch]).replace("\u2044", "/").trim());
    if (quantityAsString.length === 0) return returnValue(NaN);
    let normalizedString = quantityAsString;
    if (opts.decimalSeparator === ",") {
      const commaCount = (quantityAsString.match(/,/g) || []).length;
      if (commaCount === 1) normalizedString = quantityAsString.replaceAll(".", "_").replace(",", ".");
      else if (commaCount > 1) {
        if (!opts.allowTrailingInvalid) return returnValue(NaN);
        const firstCommaIndex = quantityAsString.indexOf(",");
        const secondCommaIndex = quantityAsString.indexOf(",", firstCommaIndex + 1);
        const beforeSecondComma = quantityAsString.substring(0, secondCommaIndex).replaceAll(".", "_").replace(",", ".");
        const afterSecondComma = quantityAsString.substring(secondCommaIndex + 1);
        normalizedString = opts.allowTrailingInvalid ? beforeSecondComma + "&" + afterSecondComma : beforeSecondComma;
      } else normalizedString = quantityAsString.replaceAll(".", "_");
    }
    const regexResult = numericRegexWithTrailingInvalid.exec(normalizedString);
    if (!regexResult) return returnValue(opts.romanNumerals ? parseRomanNumerals(quantityAsString) : NaN);
    const rawTrailing = (regexResult[7] || normalizedString.slice(regexResult[0].length)).trim();
    if (rawTrailing) {
      trailingInvalid = rawTrailing;
      if (!opts.allowTrailingInvalid) return returnValue(NaN);
    }
    const [, sign, ng1temp, ng2temp] = regexResult;
    if (sign === "-" || sign === "+") parsedSign = sign;
    const numberGroup1 = ng1temp.replaceAll(",", "").replaceAll("_", "");
    const numberGroup2 = ng2temp === null || ng2temp === void 0 ? void 0 : ng2temp.replaceAll(",", "").replaceAll("_", "");
    if (!numberGroup1 && numberGroup2 && numberGroup2.startsWith(".")) finalResult = 0;
    else {
      if (opts.bigIntOnOverflow) {
        const asBigInt = sign === "-" ? BigInt(`-${numberGroup1}`) : BigInt(numberGroup1);
        if (asBigInt > BigInt(Number.MAX_SAFE_INTEGER) || asBigInt < BigInt(Number.MIN_SAFE_INTEGER)) return returnValue(asBigInt);
      }
      finalResult = parseInt(numberGroup1);
    }
    if (!numberGroup2) {
      finalResult = sign === "-" ? finalResult * -1 : finalResult;
      if (percentageSuffix && opts.percentage !== "number") finalResult = finalResult / 100;
      return returnValue(finalResult);
    }
    const roundingFactor = opts.round === false ? NaN : parseFloat(`1e${Math.floor(Math.max(0, opts.round))}`);
    if (numberGroup2.startsWith(".") || numberGroup2.startsWith("e") || numberGroup2.startsWith("E")) {
      const decimalValue = parseFloat(`${finalResult}${numberGroup2}`);
      finalResult = isNaN(roundingFactor) ? decimalValue : Math.round(decimalValue * roundingFactor) / roundingFactor;
    } else if (spaceThenSlashRegex.test(numberGroup2)) {
      const numerator = parseInt(numberGroup1);
      const denominator = parseInt(numberGroup2.replace("/", ""));
      parsedNumerator = numerator;
      parsedDenominator = denominator;
      finalResult = isNaN(roundingFactor) ? numerator / denominator : Math.round(numerator * roundingFactor / denominator) / roundingFactor;
    } else {
      const [numerator, denominator] = numberGroup2.split("/").map((v) => parseInt(v));
      parsedWhole = finalResult;
      parsedNumerator = numerator;
      parsedDenominator = denominator;
      finalResult += isNaN(roundingFactor) ? numerator / denominator : Math.round(numerator * roundingFactor / denominator) / roundingFactor;
    }
    finalResult = sign === "-" ? finalResult * -1 : finalResult;
    if (percentageSuffix && opts.percentage !== "number") finalResult = isNaN(roundingFactor) ? finalResult / 100 : Math.round(finalResult / 100 * roundingFactor) / roundingFactor;
    return returnValue(finalResult);
  }

  // node_modules/immer/dist/immer.mjs
  var NOTHING = Symbol.for("immer-nothing");
  var DRAFTABLE = Symbol.for("immer-draftable");
  var DRAFT_STATE = Symbol.for("immer-state");
  function die(error, ...args) {
    if (false) {
      const e = errors[error];
      const msg = isFunction(e) ? e.apply(null, args) : e;
      throw new Error(`[Immer] ${msg}`);
    }
    throw new Error(
      `[Immer] minified error nr: ${error}. Full error at: https://bit.ly/3cXEKWf`
    );
  }
  var O = Object;
  var getPrototypeOf = O.getPrototypeOf;
  var CONSTRUCTOR = "constructor";
  var PROTOTYPE = "prototype";
  var CONFIGURABLE = "configurable";
  var ENUMERABLE = "enumerable";
  var WRITABLE = "writable";
  var VALUE = "value";
  var isDraft = (value) => !!value && !!value[DRAFT_STATE];
  function isDraftable(value) {
    if (!value)
      return false;
    return isPlainObject(value) || isArray(value) || !!value[DRAFTABLE] || !!value[CONSTRUCTOR]?.[DRAFTABLE] || isMap(value) || isSet(value);
  }
  var objectCtorString = O[PROTOTYPE][CONSTRUCTOR].toString();
  var cachedCtorStrings = /* @__PURE__ */ new WeakMap();
  function isPlainObject(value) {
    if (!value || !isObjectish(value))
      return false;
    const proto = getPrototypeOf(value);
    if (proto === null || proto === O[PROTOTYPE])
      return true;
    const Ctor = O.hasOwnProperty.call(proto, CONSTRUCTOR) && proto[CONSTRUCTOR];
    if (Ctor === Object)
      return true;
    if (!isFunction(Ctor))
      return false;
    let ctorString = cachedCtorStrings.get(Ctor);
    if (ctorString === void 0) {
      ctorString = Function.toString.call(Ctor);
      cachedCtorStrings.set(Ctor, ctorString);
    }
    return ctorString === objectCtorString;
  }
  function each(obj, iter, strict = true) {
    if (getArchtype(obj) === 0) {
      const keys = strict ? Reflect.ownKeys(obj) : O.keys(obj);
      keys.forEach((key) => {
        iter(key, obj[key], obj);
      });
    } else {
      obj.forEach((entry, index) => iter(index, entry, obj));
    }
  }
  function getArchtype(thing) {
    const state = thing[DRAFT_STATE];
    return state ? state.type_ : isArray(thing) ? 1 : isMap(thing) ? 2 : isSet(thing) ? 3 : 0;
  }
  var has = (thing, prop, type = getArchtype(thing)) => type === 2 ? thing.has(prop) : O[PROTOTYPE].hasOwnProperty.call(thing, prop);
  var get = (thing, prop, type = getArchtype(thing)) => (
    // @ts-ignore
    type === 2 ? thing.get(prop) : thing[prop]
  );
  var set = (thing, propOrOldValue, value, type = getArchtype(thing)) => {
    if (type === 2)
      thing.set(propOrOldValue, value);
    else if (type === 3) {
      thing.add(value);
    } else
      thing[propOrOldValue] = value;
  };
  function is(x, y) {
    if (x === y) {
      return x !== 0 || 1 / x === 1 / y;
    } else {
      return x !== x && y !== y;
    }
  }
  var isArray = Array.isArray;
  var isMap = (target) => target instanceof Map;
  var isSet = (target) => target instanceof Set;
  var isObjectish = (target) => typeof target === "object";
  var isFunction = (target) => typeof target === "function";
  var isBoolean = (target) => typeof target === "boolean";
  function isArrayIndex(value) {
    const n = +value;
    return Number.isInteger(n) && String(n) === value;
  }
  var latest = (state) => state.copy_ || state.base_;
  var getFinalValue = (state) => state.modified_ ? state.copy_ : state.base_;
  function shallowCopy(base, strict) {
    if (isMap(base)) {
      return new Map(base);
    }
    if (isSet(base)) {
      return new Set(base);
    }
    if (isArray(base))
      return Array[PROTOTYPE].slice.call(base);
    const isPlain = isPlainObject(base);
    if (strict === true || strict === "class_only" && !isPlain) {
      const descriptors = O.getOwnPropertyDescriptors(base);
      delete descriptors[DRAFT_STATE];
      let keys = Reflect.ownKeys(descriptors);
      for (let i = 0; i < keys.length; i++) {
        const key = keys[i];
        const desc = descriptors[key];
        if (desc[WRITABLE] === false) {
          desc[WRITABLE] = true;
          desc[CONFIGURABLE] = true;
        }
        if (desc.get || desc.set)
          descriptors[key] = {
            [CONFIGURABLE]: true,
            [WRITABLE]: true,
            // could live with !!desc.set as well here...
            [ENUMERABLE]: desc[ENUMERABLE],
            [VALUE]: base[key]
          };
      }
      return O.create(getPrototypeOf(base), descriptors);
    } else {
      const proto = getPrototypeOf(base);
      if (proto !== null && isPlain) {
        return { ...base };
      }
      const obj = O.create(proto);
      return O.assign(obj, base);
    }
  }
  function freeze(obj, deep = false) {
    if (isFrozen(obj) || isDraft(obj) || !isDraftable(obj))
      return obj;
    if (getArchtype(obj) > 1) {
      O.defineProperties(obj, {
        set: dontMutateMethodOverride,
        add: dontMutateMethodOverride,
        clear: dontMutateMethodOverride,
        delete: dontMutateMethodOverride
      });
    }
    O.freeze(obj);
    if (deep)
      each(
        obj,
        (_key, value) => {
          freeze(value, true);
        },
        false
      );
    return obj;
  }
  function dontMutateFrozenCollections() {
    die(2);
  }
  var dontMutateMethodOverride = {
    [VALUE]: dontMutateFrozenCollections
  };
  function isFrozen(obj) {
    if (obj === null || !isObjectish(obj))
      return true;
    return O.isFrozen(obj);
  }
  var PluginMapSet = "MapSet";
  var PluginPatches = "Patches";
  var PluginArrayMethods = "ArrayMethods";
  var plugins = {};
  function getPlugin(pluginKey) {
    const plugin = plugins[pluginKey];
    if (!plugin) {
      die(0, pluginKey);
    }
    return plugin;
  }
  var isPluginLoaded = (pluginKey) => !!plugins[pluginKey];
  var currentScope;
  var getCurrentScope = () => currentScope;
  var createScope = (parent_, immer_) => ({
    drafts_: [],
    parent_,
    immer_,
    // Whenever the modified draft contains a draft from another scope, we
    // need to prevent auto-freezing so the unowned draft can be finalized.
    canAutoFreeze_: true,
    unfinalizedDrafts_: 0,
    handledSet_: /* @__PURE__ */ new Set(),
    processedForPatches_: /* @__PURE__ */ new Set(),
    mapSetPlugin_: isPluginLoaded(PluginMapSet) ? getPlugin(PluginMapSet) : void 0,
    arrayMethodsPlugin_: isPluginLoaded(PluginArrayMethods) ? getPlugin(PluginArrayMethods) : void 0
  });
  function usePatchesInScope(scope, patchListener) {
    if (patchListener) {
      scope.patchPlugin_ = getPlugin(PluginPatches);
      scope.patches_ = [];
      scope.inversePatches_ = [];
      scope.patchListener_ = patchListener;
    }
  }
  function revokeScope(scope) {
    leaveScope(scope);
    scope.drafts_.forEach(revokeDraft);
    scope.drafts_ = null;
  }
  function leaveScope(scope) {
    if (scope === currentScope) {
      currentScope = scope.parent_;
    }
  }
  var enterScope = (immer2) => currentScope = createScope(currentScope, immer2);
  function revokeDraft(draft) {
    const state = draft[DRAFT_STATE];
    if (state.type_ === 0 || state.type_ === 1)
      state.revoke_();
    else
      state.revoked_ = true;
  }
  function processResult(result, scope) {
    scope.unfinalizedDrafts_ = scope.drafts_.length;
    const baseDraft = scope.drafts_[0];
    const isReplaced = result !== void 0 && result !== baseDraft;
    if (isReplaced) {
      if (baseDraft[DRAFT_STATE].modified_) {
        revokeScope(scope);
        die(4);
      }
      if (isDraftable(result)) {
        result = finalize(scope, result);
      }
      const { patchPlugin_ } = scope;
      if (patchPlugin_) {
        patchPlugin_.generateReplacementPatches_(
          baseDraft[DRAFT_STATE].base_,
          result,
          scope
        );
      }
    } else {
      result = finalize(scope, baseDraft);
    }
    maybeFreeze(scope, result, true);
    revokeScope(scope);
    if (scope.patches_) {
      scope.patchListener_(scope.patches_, scope.inversePatches_);
    }
    return result !== NOTHING ? result : void 0;
  }
  function finalize(rootScope, value) {
    if (isFrozen(value))
      return value;
    const state = value[DRAFT_STATE];
    if (!state) {
      const finalValue = handleValue(value, rootScope.handledSet_, rootScope);
      return finalValue;
    }
    if (!isSameScope(state, rootScope)) {
      return value;
    }
    if (!state.modified_) {
      return state.base_;
    }
    if (!state.finalized_) {
      const { callbacks_ } = state;
      if (callbacks_) {
        while (callbacks_.length > 0) {
          const callback = callbacks_.pop();
          callback(rootScope);
        }
      }
      generatePatchesAndFinalize(state, rootScope);
    }
    return state.copy_;
  }
  function maybeFreeze(scope, value, deep = false) {
    if (!scope.parent_ && scope.immer_.autoFreeze_ && scope.canAutoFreeze_) {
      freeze(value, deep);
    }
  }
  function markStateFinalized(state) {
    state.finalized_ = true;
    state.scope_.unfinalizedDrafts_--;
  }
  var isSameScope = (state, rootScope) => state.scope_ === rootScope;
  var EMPTY_LOCATIONS_RESULT = [];
  function updateDraftInParent(parent, draftValue, finalizedValue, originalKey) {
    const parentCopy = latest(parent);
    const parentType = parent.type_;
    if (originalKey !== void 0) {
      const currentValue = get(parentCopy, originalKey, parentType);
      if (currentValue === draftValue) {
        set(parentCopy, originalKey, finalizedValue, parentType);
        return;
      }
    }
    if (!parent.draftLocations_) {
      const draftLocations = parent.draftLocations_ = /* @__PURE__ */ new Map();
      each(parentCopy, (key, value) => {
        if (isDraft(value)) {
          const keys = draftLocations.get(value) || [];
          keys.push(key);
          draftLocations.set(value, keys);
        }
      });
    }
    const locations = parent.draftLocations_.get(draftValue) ?? EMPTY_LOCATIONS_RESULT;
    for (const location of locations) {
      set(parentCopy, location, finalizedValue, parentType);
    }
  }
  function registerChildFinalizationCallback(parent, child, key) {
    parent.callbacks_.push(function childCleanup(rootScope) {
      const state = child;
      if (!state || !isSameScope(state, rootScope)) {
        return;
      }
      rootScope.mapSetPlugin_?.fixSetContents(state);
      const finalizedValue = getFinalValue(state);
      updateDraftInParent(parent, state.draft_ ?? state, finalizedValue, key);
      generatePatchesAndFinalize(state, rootScope);
    });
  }
  function generatePatchesAndFinalize(state, rootScope) {
    const shouldFinalize = state.modified_ && !state.finalized_ && (state.type_ === 3 || state.type_ === 1 && state.allIndicesReassigned_ || (state.assigned_?.size ?? 0) > 0);
    if (shouldFinalize) {
      const { patchPlugin_ } = rootScope;
      if (patchPlugin_) {
        const basePath = patchPlugin_.getPath(state);
        if (basePath) {
          patchPlugin_.generatePatches_(state, basePath, rootScope);
        }
      }
      markStateFinalized(state);
    }
  }
  function handleCrossReference(target, key, value) {
    const { scope_ } = target;
    if (isDraft(value)) {
      const state = value[DRAFT_STATE];
      if (isSameScope(state, scope_)) {
        state.callbacks_.push(function crossReferenceCleanup() {
          prepareCopy(target);
          const finalizedValue = getFinalValue(state);
          updateDraftInParent(target, value, finalizedValue, key);
        });
      }
    } else if (isDraftable(value)) {
      target.callbacks_.push(function nestedDraftCleanup() {
        const targetCopy = latest(target);
        if (target.type_ === 3) {
          if (targetCopy.has(value)) {
            handleValue(value, scope_.handledSet_, scope_);
          }
        } else {
          if (get(targetCopy, key, target.type_) === value) {
            if (scope_.drafts_.length > 1 && (target.assigned_.get(key) ?? false) === true && target.copy_) {
              handleValue(
                get(target.copy_, key, target.type_),
                scope_.handledSet_,
                scope_
              );
            }
          }
        }
      });
    }
  }
  function handleValue(target, handledSet, rootScope) {
    if (!rootScope.immer_.autoFreeze_ && rootScope.unfinalizedDrafts_ < 1) {
      return target;
    }
    if (isDraft(target) || handledSet.has(target) || !isDraftable(target) || isFrozen(target)) {
      return target;
    }
    handledSet.add(target);
    each(target, (key, value) => {
      if (isDraft(value)) {
        const state = value[DRAFT_STATE];
        if (isSameScope(state, rootScope)) {
          const updatedValue = getFinalValue(state);
          set(target, key, updatedValue, target.type_);
          markStateFinalized(state);
        }
      } else if (isDraftable(value)) {
        handleValue(value, handledSet, rootScope);
      }
    });
    return target;
  }
  function createProxyProxy(base, parent) {
    const baseIsArray = isArray(base);
    const state = {
      type_: baseIsArray ? 1 : 0,
      // Track which produce call this is associated with.
      scope_: parent ? parent.scope_ : getCurrentScope(),
      // True for both shallow and deep changes.
      modified_: false,
      // Used during finalization.
      finalized_: false,
      // Track which properties have been assigned (true) or deleted (false).
      // actually instantiated in `prepareCopy()`
      assigned_: void 0,
      // The parent draft state.
      parent_: parent,
      // The base state.
      base_: base,
      // The base proxy.
      draft_: null,
      // set below
      // The base copy with any updated values.
      copy_: null,
      // Called by the `produce` function.
      revoke_: null,
      isManual_: false,
      // `callbacks` actually gets assigned in `createProxy`
      callbacks_: void 0
    };
    let target = state;
    let traps = objectTraps;
    if (baseIsArray) {
      target = [state];
      traps = arrayTraps;
    }
    const { revoke, proxy } = Proxy.revocable(target, traps);
    state.draft_ = proxy;
    state.revoke_ = revoke;
    return [proxy, state];
  }
  var objectTraps = {
    get(state, prop) {
      if (prop === DRAFT_STATE)
        return state;
      let arrayPlugin = state.scope_.arrayMethodsPlugin_;
      const isArrayWithStringProp = state.type_ === 1 && typeof prop === "string";
      if (isArrayWithStringProp) {
        if (arrayPlugin?.isArrayOperationMethod(prop)) {
          return arrayPlugin.createMethodInterceptor(state, prop);
        }
      }
      const source = latest(state);
      if (!has(source, prop, state.type_)) {
        return readPropFromProto(state, source, prop);
      }
      const value = source[prop];
      if (state.finalized_ || !isDraftable(value)) {
        return value;
      }
      if (isArrayWithStringProp && state.operationMethod && arrayPlugin?.isMutatingArrayMethod(
        state.operationMethod
      ) && isArrayIndex(prop)) {
        return value;
      }
      if (value === peek(state.base_, prop)) {
        prepareCopy(state);
        const childKey = state.type_ === 1 ? +prop : prop;
        const childDraft = createProxy(state.scope_, value, state, childKey);
        return state.copy_[childKey] = childDraft;
      }
      return value;
    },
    has(state, prop) {
      return prop in latest(state);
    },
    ownKeys(state) {
      return Reflect.ownKeys(latest(state));
    },
    set(state, prop, value) {
      const desc = getDescriptorFromProto(latest(state), prop);
      if (desc?.set) {
        desc.set.call(state.draft_, value);
        return true;
      }
      if (!state.modified_) {
        const current2 = peek(latest(state), prop);
        const currentState = current2?.[DRAFT_STATE];
        if (currentState && currentState.base_ === value) {
          state.copy_[prop] = value;
          state.assigned_.set(prop, false);
          return true;
        }
        if (is(value, current2) && (value !== void 0 || has(state.base_, prop, state.type_)))
          return true;
        prepareCopy(state);
        markChanged(state);
      }
      if (state.copy_[prop] === value && // special case: handle new props with value 'undefined'
      (value !== void 0 || prop in state.copy_) || // special case: NaN
      Number.isNaN(value) && Number.isNaN(state.copy_[prop]))
        return true;
      state.copy_[prop] = value;
      state.assigned_.set(prop, true);
      handleCrossReference(state, prop, value);
      return true;
    },
    deleteProperty(state, prop) {
      prepareCopy(state);
      if (peek(state.base_, prop) !== void 0 || prop in state.base_) {
        state.assigned_.set(prop, false);
        markChanged(state);
      } else {
        state.assigned_.delete(prop);
      }
      if (state.copy_) {
        delete state.copy_[prop];
      }
      return true;
    },
    // Note: We never coerce `desc.value` into an Immer draft, because we can't make
    // the same guarantee in ES5 mode.
    getOwnPropertyDescriptor(state, prop) {
      const owner = latest(state);
      const desc = Reflect.getOwnPropertyDescriptor(owner, prop);
      if (!desc)
        return desc;
      return {
        [WRITABLE]: true,
        [CONFIGURABLE]: state.type_ !== 1 || prop !== "length",
        [ENUMERABLE]: desc[ENUMERABLE],
        [VALUE]: owner[prop]
      };
    },
    defineProperty() {
      die(11);
    },
    getPrototypeOf(state) {
      return getPrototypeOf(state.base_);
    },
    setPrototypeOf() {
      die(12);
    }
  };
  var arrayTraps = {};
  for (let key in objectTraps) {
    let fn = objectTraps[key];
    arrayTraps[key] = function() {
      const args = arguments;
      args[0] = args[0][0];
      return fn.apply(this, args);
    };
  }
  arrayTraps.deleteProperty = function(state, prop) {
    if (false)
      die(13);
    return arrayTraps.set.call(this, state, prop, void 0);
  };
  arrayTraps.set = function(state, prop, value) {
    if (false)
      die(14);
    return objectTraps.set.call(this, state[0], prop, value, state[0]);
  };
  function peek(draft, prop) {
    const state = draft[DRAFT_STATE];
    const source = state ? latest(state) : draft;
    return source[prop];
  }
  function readPropFromProto(state, source, prop) {
    const desc = getDescriptorFromProto(source, prop);
    return desc ? VALUE in desc ? desc[VALUE] : (
      // This is a very special case, if the prop is a getter defined by the
      // prototype, we should invoke it with the draft as context!
      desc.get?.call(state.draft_)
    ) : void 0;
  }
  function getDescriptorFromProto(source, prop) {
    if (!(prop in source))
      return void 0;
    let proto = getPrototypeOf(source);
    while (proto) {
      const desc = Object.getOwnPropertyDescriptor(proto, prop);
      if (desc)
        return desc;
      proto = getPrototypeOf(proto);
    }
    return void 0;
  }
  function markChanged(state) {
    if (!state.modified_) {
      state.modified_ = true;
      if (state.parent_) {
        markChanged(state.parent_);
      }
    }
  }
  function prepareCopy(state) {
    if (!state.copy_) {
      state.assigned_ = /* @__PURE__ */ new Map();
      state.copy_ = shallowCopy(
        state.base_,
        state.scope_.immer_.useStrictShallowCopy_
      );
    }
  }
  var Immer2 = class {
    constructor(config) {
      this.autoFreeze_ = true;
      this.useStrictShallowCopy_ = false;
      this.useStrictIteration_ = false;
      this.produce = (base, recipe, patchListener) => {
        if (isFunction(base) && !isFunction(recipe)) {
          const defaultBase = recipe;
          recipe = base;
          const self = this;
          return function curriedProduce(base2 = defaultBase, ...args) {
            return self.produce(base2, (draft) => recipe.call(this, draft, ...args));
          };
        }
        if (!isFunction(recipe))
          die(6);
        if (patchListener !== void 0 && !isFunction(patchListener))
          die(7);
        let result;
        if (isDraftable(base)) {
          const scope = enterScope(this);
          const proxy = createProxy(scope, base, void 0);
          let hasError = true;
          try {
            result = recipe(proxy);
            hasError = false;
          } finally {
            if (hasError)
              revokeScope(scope);
            else
              leaveScope(scope);
          }
          usePatchesInScope(scope, patchListener);
          return processResult(result, scope);
        } else if (!base || !isObjectish(base)) {
          result = recipe(base);
          if (result === void 0)
            result = base;
          if (result === NOTHING)
            result = void 0;
          if (this.autoFreeze_)
            freeze(result, true);
          if (patchListener) {
            const p = [];
            const ip = [];
            getPlugin(PluginPatches).generateReplacementPatches_(base, result, {
              patches_: p,
              inversePatches_: ip
            });
            patchListener(p, ip);
          }
          return result;
        } else
          die(1, base);
      };
      this.produceWithPatches = (base, recipe) => {
        if (isFunction(base)) {
          return (state, ...args) => this.produceWithPatches(state, (draft) => base(draft, ...args));
        }
        let patches, inversePatches;
        const result = this.produce(base, recipe, (p, ip) => {
          patches = p;
          inversePatches = ip;
        });
        return [result, patches, inversePatches];
      };
      if (isBoolean(config?.autoFreeze))
        this.setAutoFreeze(config.autoFreeze);
      if (isBoolean(config?.useStrictShallowCopy))
        this.setUseStrictShallowCopy(config.useStrictShallowCopy);
      if (isBoolean(config?.useStrictIteration))
        this.setUseStrictIteration(config.useStrictIteration);
    }
    createDraft(base) {
      if (!isDraftable(base))
        die(8);
      if (isDraft(base))
        base = current(base);
      const scope = enterScope(this);
      const proxy = createProxy(scope, base, void 0);
      proxy[DRAFT_STATE].isManual_ = true;
      leaveScope(scope);
      return proxy;
    }
    finishDraft(draft, patchListener) {
      const state = draft && draft[DRAFT_STATE];
      if (!state || !state.isManual_)
        die(9);
      const { scope_: scope } = state;
      usePatchesInScope(scope, patchListener);
      return processResult(void 0, scope);
    }
    /**
     * Pass true to automatically freeze all copies created by Immer.
     *
     * By default, auto-freezing is enabled.
     */
    setAutoFreeze(value) {
      this.autoFreeze_ = value;
    }
    /**
     * Pass true to enable strict shallow copy.
     *
     * By default, immer does not copy the object descriptors such as getter, setter and non-enumrable properties.
     */
    setUseStrictShallowCopy(value) {
      this.useStrictShallowCopy_ = value;
    }
    /**
     * Pass false to use faster iteration that skips non-enumerable properties
     * but still handles symbols for compatibility.
     *
     * By default, strict iteration is enabled (includes all own properties).
     */
    setUseStrictIteration(value) {
      this.useStrictIteration_ = value;
    }
    shouldUseStrictIteration() {
      return this.useStrictIteration_;
    }
    applyPatches(base, patches) {
      let i;
      for (i = patches.length - 1; i >= 0; i--) {
        const patch = patches[i];
        if (patch.path.length === 0 && patch.op === "replace") {
          base = patch.value;
          break;
        }
      }
      if (i > -1) {
        patches = patches.slice(i + 1);
      }
      const applyPatchesImpl = getPlugin(PluginPatches).applyPatches_;
      if (isDraft(base)) {
        return applyPatchesImpl(base, patches);
      }
      return this.produce(
        base,
        (draft) => applyPatchesImpl(draft, patches)
      );
    }
  };
  function createProxy(rootScope, value, parent, key) {
    const [draft, state] = isMap(value) ? getPlugin(PluginMapSet).proxyMap_(value, parent) : isSet(value) ? getPlugin(PluginMapSet).proxySet_(value, parent) : createProxyProxy(value, parent);
    const scope = parent?.scope_ ?? getCurrentScope();
    scope.drafts_.push(draft);
    state.callbacks_ = parent?.callbacks_ ?? [];
    state.key_ = key;
    if (parent && key !== void 0) {
      registerChildFinalizationCallback(parent, state, key);
    } else {
      state.callbacks_.push(function rootDraftCleanup(rootScope2) {
        rootScope2.mapSetPlugin_?.fixSetContents(state);
        const { patchPlugin_ } = rootScope2;
        if (state.modified_ && patchPlugin_) {
          patchPlugin_.generatePatches_(state, [], rootScope2);
        }
      });
    }
    return draft;
  }
  function current(value) {
    if (!isDraft(value))
      die(10, value);
    return currentImpl(value);
  }
  function currentImpl(value) {
    if (!isDraftable(value) || isFrozen(value))
      return value;
    const state = value[DRAFT_STATE];
    let copy;
    let strict = true;
    if (state) {
      if (!state.modified_)
        return state.base_;
      state.finalized_ = true;
      copy = shallowCopy(value, state.scope_.immer_.useStrictShallowCopy_);
      strict = state.scope_.immer_.shouldUseStrictIteration();
    } else {
      copy = shallowCopy(value, true);
    }
    each(
      copy,
      (key, childValue) => {
        set(copy, key, currentImpl(childValue));
      },
      strict
    );
    if (state) {
      state.finalized_ = false;
    }
    return copy;
  }
  var immer = new Immer2();
  var produce = immer.produce;

  // node_modules/@react-querybuilder/core/dist/react-querybuilder_core.mjs
  var defaultPlaceholderLabel = "------";
  var defaultPlaceholderFieldLabel = defaultPlaceholderLabel;
  var defaultPlaceholderFieldGroupLabel = defaultPlaceholderLabel;
  var defaultPlaceholderOperatorLabel = defaultPlaceholderLabel;
  var defaultPlaceholderOperatorGroupLabel = defaultPlaceholderLabel;
  var defaultPlaceholderValueLabel = defaultPlaceholderLabel;
  var defaultPlaceholderValueGroupLabel = defaultPlaceholderLabel;
  var defaultTranslations = {
    fields: {
      title: "Field",
      placeholderName: "~",
      placeholderLabel: defaultPlaceholderFieldLabel,
      placeholderGroupLabel: defaultPlaceholderFieldGroupLabel
    },
    operators: {
      title: "Operator",
      placeholderName: "~",
      placeholderLabel: defaultPlaceholderOperatorLabel,
      placeholderGroupLabel: defaultPlaceholderOperatorGroupLabel
    },
    values: {
      title: "Values",
      placeholderName: "~",
      placeholderLabel: defaultPlaceholderValueLabel,
      placeholderGroupLabel: defaultPlaceholderValueGroupLabel
    },
    matchMode: { title: "Match mode" },
    matchThreshold: {
      title: "Match threshold",
      placeholderName: "#"
    },
    value: { title: "Value" },
    removeRule: {
      label: "\u2A2F",
      title: "Remove rule"
    },
    removeGroup: {
      label: "\u2A2F",
      title: "Remove group"
    },
    addRule: {
      label: "+ Rule",
      title: "Add rule"
    },
    addGroup: {
      label: "+ Group",
      title: "Add group"
    },
    combinators: { title: "Combinator" },
    notToggle: {
      label: "Not",
      title: "Invert this group"
    },
    cloneRule: {
      label: "\u29C9",
      title: "Clone rule"
    },
    cloneRuleGroup: {
      label: "\u29C9",
      title: "Clone group"
    },
    shiftActionUp: {
      label: "\u02C4",
      title: "Shift up"
    },
    shiftActionDown: {
      label: "\u02C5",
      title: "Shift down"
    },
    dragHandle: {
      label: "\u205E\u205E",
      title: "Drag handle"
    },
    lockRule: {
      label: "\u{1F513}",
      title: "Lock rule"
    },
    lockGroup: {
      label: "\u{1F513}",
      title: "Lock group"
    },
    lockRuleDisabled: {
      label: "\u{1F512}",
      title: "Unlock rule"
    },
    lockGroupDisabled: {
      label: "\u{1F512}",
      title: "Unlock group"
    },
    muteRule: {
      label: "\u{1F50A}",
      title: "Mute rule"
    },
    muteGroup: {
      label: "\u{1F50A}",
      title: "Mute group"
    },
    unmuteRule: {
      label: "\u{1F507}",
      title: "Unmute rule"
    },
    unmuteGroup: {
      label: "\u{1F507}",
      title: "Unmute group"
    },
    valueSourceSelector: { title: "Value source" }
  };
  var defaultOperatorLabelMap = {
    "=": "=",
    "!=": "!=",
    "<": "<",
    ">": ">",
    "<=": "<=",
    ">=": ">=",
    contains: "contains",
    beginsWith: "begins with",
    endsWith: "ends with",
    doesNotContain: "does not contain",
    doesNotBeginWith: "does not begin with",
    doesNotEndWith: "does not end with",
    null: "is null",
    notNull: "is not null",
    in: "in",
    notIn: "not in",
    between: "between",
    notBetween: "not between"
  };
  var defaultCombinatorLabelMap = {
    and: "AND",
    or: "OR",
    xor: "XOR"
  };
  var defaultOperators = [
    {
      name: "=",
      value: "=",
      label: "="
    },
    {
      name: "!=",
      value: "!=",
      label: "!="
    },
    {
      name: "<",
      value: "<",
      label: "<"
    },
    {
      name: ">",
      value: ">",
      label: ">"
    },
    {
      name: "<=",
      value: "<=",
      label: "<="
    },
    {
      name: ">=",
      value: ">=",
      label: ">="
    },
    {
      name: "contains",
      value: "contains",
      label: "contains"
    },
    {
      name: "beginsWith",
      value: "beginsWith",
      label: "begins with"
    },
    {
      name: "endsWith",
      value: "endsWith",
      label: "ends with"
    },
    {
      name: "doesNotContain",
      value: "doesNotContain",
      label: "does not contain"
    },
    {
      name: "doesNotBeginWith",
      value: "doesNotBeginWith",
      label: "does not begin with"
    },
    {
      name: "doesNotEndWith",
      value: "doesNotEndWith",
      label: "does not end with"
    },
    {
      name: "null",
      value: "null",
      label: "is null"
    },
    {
      name: "notNull",
      value: "notNull",
      label: "is not null"
    },
    {
      name: "in",
      value: "in",
      label: "in"
    },
    {
      name: "notIn",
      value: "notIn",
      label: "not in"
    },
    {
      name: "between",
      value: "between",
      label: "between"
    },
    {
      name: "notBetween",
      value: "notBetween",
      label: "not between"
    }
  ];
  var defaultCombinators = [{
    name: "and",
    value: "and",
    label: "AND"
  }, {
    name: "or",
    value: "or",
    label: "OR"
  }];
  var defaultCombinatorsExtended = [...defaultCombinators, {
    name: "xor",
    value: "xor",
    label: "XOR"
  }];
  var defaultMatchModes = [
    {
      name: "all",
      value: "all",
      label: "all"
    },
    {
      name: "some",
      value: "some",
      label: "some"
    },
    {
      name: "none",
      value: "none",
      label: "none"
    },
    {
      name: "atLeast",
      value: "atLeast",
      label: "at least"
    },
    {
      name: "atMost",
      value: "atMost",
      label: "at most"
    },
    {
      name: "exactly",
      value: "exactly",
      label: "exactly"
    }
  ];
  var standardClassnames = {
    queryBuilder: "queryBuilder",
    ruleGroup: "ruleGroup",
    header: "ruleGroup-header",
    body: "ruleGroup-body",
    combinators: "ruleGroup-combinators",
    addRule: "ruleGroup-addRule",
    addGroup: "ruleGroup-addGroup",
    cloneRule: "rule-cloneRule",
    cloneGroup: "ruleGroup-cloneGroup",
    removeGroup: "ruleGroup-remove",
    notToggle: "ruleGroup-notToggle",
    rule: "rule",
    fields: "rule-fields",
    matchMode: "rule-matchMode",
    matchThreshold: "rule-matchThreshold",
    operators: "rule-operators",
    value: "rule-value",
    removeRule: "rule-remove",
    betweenRules: "betweenRules",
    valid: "queryBuilder-valid",
    invalid: "queryBuilder-invalid",
    shiftActions: "shiftActions",
    dndDragging: "dndDragging",
    dndOver: "dndOver",
    dndCopy: "dndCopy",
    dndGroup: "dndGroup",
    dndDropNotAllowed: "dndDropNotAllowed",
    dndPreviewPosition: "dndPreviewPosition",
    dndHidden: "dndHidden",
    dragHandle: "queryBuilder-dragHandle",
    disabled: "queryBuilder-disabled",
    muted: "queryBuilder-muted",
    lockRule: "rule-lock",
    lockGroup: "ruleGroup-lock",
    muteRule: "rule-mute",
    muteGroup: "ruleGroup-mute",
    valueSource: "rule-valueSource",
    valueListItem: "rule-value-list-item",
    branches: "queryBuilder-branches",
    justified: "queryBuilder-justified",
    hasSubQuery: "rule-hasSubQuery",
    loading: "queryBuilder-loading"
  };
  var defaultControlClassnames = {
    queryBuilder: "",
    ruleGroup: "",
    header: "",
    body: "",
    combinators: "",
    addRule: "",
    addGroup: "",
    cloneRule: "",
    cloneGroup: "",
    removeGroup: "",
    notToggle: "",
    rule: "",
    fields: "",
    matchMode: "",
    matchThreshold: "",
    operators: "",
    value: "",
    removeRule: "",
    shiftActions: "",
    dragHandle: "",
    lockRule: "",
    lockGroup: "",
    muteRule: "",
    muteGroup: "",
    muted: "",
    valueSource: "",
    actionElement: "",
    valueSelector: "",
    betweenRules: "",
    valid: "",
    invalid: "",
    dndDragging: "",
    dndOver: "",
    dndGroup: "",
    dndCopy: "",
    dndDropNotAllowed: "",
    dndPreviewPosition: "",
    dndHidden: "",
    disabled: "",
    valueListItem: "",
    branches: "",
    hasSubQuery: "",
    loading: ""
  };
  var TestID = {
    rule: "rule",
    ruleGroup: "rule-group",
    inlineCombinator: "inline-combinator",
    addGroup: "add-group",
    removeGroup: "remove-group",
    cloneGroup: "clone-group",
    cloneRule: "clone-rule",
    addRule: "add-rule",
    removeRule: "remove-rule",
    combinators: "combinators",
    fields: "fields",
    operators: "operators",
    valueEditor: "value-editor",
    notToggle: "not-toggle",
    shiftActions: "shift-actions",
    dragHandle: "drag-handle",
    lockRule: "lock-rule",
    lockGroup: "lock-group",
    muteRule: "mute-rule",
    muteGroup: "mute-group",
    valueSourceSelector: "value-source-selector",
    matchModeEditor: "match-mode-editor"
  };
  var LogType = {
    parentPathDisabled: "action aborted: parent path disabled",
    pathDisabled: "action aborted: path is disabled",
    queryUpdate: "query updated",
    onAddRuleFalse: "onAddRule callback returned false",
    onAddGroupFalse: "onAddGroup callback returned false",
    onGroupRuleFalse: "onGroupRule callback returned false",
    onGroupGroupFalse: "onGroupGroup callback returned false",
    onMoveRuleFalse: "onMoveRule callback returned false",
    onMoveGroupFalse: "onMoveGroup callback returned false",
    onRemoveFalse: "onRemove callback returned false",
    add: "rule or group added",
    remove: "rule or group removed",
    update: "rule or group updated",
    move: "rule or group moved",
    group: "rule or group grouped with another"
  };
  var rootPath = [];
  var queryBuilderFlagDefaults = {
    addRuleToNewGroups: false,
    autoSelectField: true,
    autoSelectOperator: true,
    autoSelectValue: false,
    debugMode: false,
    enableDragAndDrop: false,
    enableMountQueryChange: true,
    listsAsArrays: false,
    resetOnFieldChange: true,
    resetOnOperatorChange: false,
    showCloneButtons: false,
    showCombinatorsBetweenRules: false,
    showLockButtons: false,
    showMuteButtons: false,
    showNotToggle: false,
    showShiftActions: false,
    suppressStandardClassnames: false
  };
  var splitBy = (str, splitChar = ",") => typeof str === "string" ? str.split(`\\${splitChar}`).map((c) => c.split(splitChar)).reduce((prev, curr, idx) => {
    if (idx === 0) return curr;
    return [
      ...prev.slice(0, -1),
      `${prev.at(-1)}${splitChar}${curr[0]}`,
      ...curr.slice(1)
    ];
  }, []) : [];
  var joinWith = (strArr, joinChar = ",") => strArr.map((str) => `${str ?? ""}`.replaceAll(joinChar[0], `\\${joinChar[0]}`)).join(joinChar);
  var trimIfString = (val) => typeof val === "string" ? val.trim() : val;
  var toArray = (a, { retainEmptyStrings } = {}) => Array.isArray(a) ? a.map((v) => trimIfString(v)) : typeof a === "string" ? splitBy(a, ",").filter(retainEmptyStrings ? () => true : (s) => !/^\s*$/.test(s)).map((s) => s.trim()) : typeof a === "number" ? [a] : [];
  function toVal(mix) {
    let k;
    let y;
    let str = "";
    if (typeof mix === "string" || typeof mix === "number") str += mix;
    else if (typeof mix === "object") {
      if (Array.isArray(mix)) {
        const len = mix.length;
        for (k = 0; k < len; k++) if (mix[k] && (y = toVal(mix[k]))) {
          str && (str += " ");
          str += y;
        }
      } else for (y in mix) if (mix[y]) {
        str && (str += " ");
        str += y;
      }
    }
    return str;
  }
  function clsx(...args) {
    let i = 0;
    let tmp;
    let x;
    let str = "";
    const len = args.length;
    for (; i < len; i++) if ((tmp = args[i]) && (x = toVal(tmp))) {
      str && (str += " ");
      str += x;
    }
    return str;
  }
  var lc = (v) => typeof v === "string" ? v.toLowerCase() : v;
  var numericRegex2 = new RegExp(numericRegex.source.replace(/^\^/, String.raw`^\s*`).replace(/\$$/, String.raw`\s*$`));
  var isPojo = (obj) => obj === null || typeof obj !== "object" ? false : Object.getPrototypeOf(obj) === Object.prototype;
  var nullOrUndefinedOrEmpty = (value) => value === null || value === void 0 || value === "";
  var isRuleGroup = (rg) => isPojo(rg) && Array.isArray(rg.rules);
  var isRuleGroupType = (rg) => isRuleGroup(rg) && typeof rg.combinator === "string";
  var isRuleGroupTypeIC = (rg) => isRuleGroup(rg) && rg.combinator === void 0;
  var combinatorLevels = [
    "or",
    "xor",
    "and"
  ];
  var isSameString = (a, b) => lc(a) === b;
  var generateRuleGroupICWithConsistentCombinators = (rg, baseCombinatorLevel = 0) => {
    const baseCombinator = combinatorLevels[baseCombinatorLevel];
    if (!rg.rules.includes(baseCombinator)) return baseCombinatorLevel < combinatorLevels.length - 2 ? generateRuleGroupICWithConsistentCombinators(rg, baseCombinatorLevel + 1) : rg;
    const newRules = [...rg.rules];
    let cursor = 0;
    while (cursor < newRules.length - 2) {
      if (isSameString(newRules[cursor + 1], baseCombinator)) {
        cursor += 2;
        continue;
      }
      let nextBaseCombinatorIndex = -1;
      for (let i = cursor + 2; i < newRules.length; i++) if (typeof newRules[i] === "string" && lc(newRules[i]) === baseCombinator) {
        nextBaseCombinatorIndex = i;
        break;
      }
      if (nextBaseCombinatorIndex === -1) {
        newRules.splice(cursor, newRules.length, generateRuleGroupICWithConsistentCombinators({ rules: newRules.slice(cursor) }, baseCombinatorLevel + 1));
        break;
      } else newRules.splice(cursor, nextBaseCombinatorIndex - cursor, generateRuleGroupICWithConsistentCombinators({ rules: newRules.slice(cursor, nextBaseCombinatorIndex) }, baseCombinatorLevel + 1));
    }
    return {
      ...rg,
      rules: newRules
    };
  };
  var convertFromIC = (rg) => {
    if (isRuleGroupType(rg)) return rg;
    const processedRG = generateRuleGroupICWithConsistentCombinators(rg);
    const rules = [];
    let combinator = "and";
    for (const [idx, r] of processedRG.rules.entries()) if (typeof r === "string") {
      if (idx === 1) combinator = r;
    } else rules.push(isRuleGroup(r) ? convertFromIC(r) : r);
    return {
      ...processedRG,
      combinator,
      rules
    };
  };
  var objectKeys = Object.keys;
  var objectEntries = Object.entries;
  var isUnsafeKey = (key) => key === "__proto__" || key === "constructor" || key === "prototype";
  var isOptionWithName = (opt) => isPojo(opt) && "name" in opt && typeof opt.name === "string";
  var isOptionWithValue = (opt) => isPojo(opt) && "value" in opt && typeof opt.value === "string";
  function toFullOption(opt, baseProperties, labelMap) {
    if (typeof opt === "string") return {
      ...baseProperties,
      name: opt,
      value: opt,
      label: labelMap?.[opt] ?? opt
    };
    const idObj = {};
    let needsUpdating = !!baseProperties;
    if (isOptionWithName(opt) && !isOptionWithValue(opt)) {
      idObj.value = opt.name;
      needsUpdating = true;
    } else if (!isOptionWithName(opt) && isOptionWithValue(opt)) {
      idObj.name = opt.value;
      needsUpdating = true;
    }
    if (needsUpdating) return Object.assign({}, baseProperties, opt, idObj);
    return opt;
  }
  function toFullOptionList(optList, baseProperties, labelMap) {
    if (!Array.isArray(optList)) return [];
    const list = optList;
    if (isFlexibleOptionGroupArray(list)) return list.map((optGroup) => ({
      ...optGroup,
      options: optGroup.options.map((opt) => toFullOption(opt, baseProperties, labelMap))
    }));
    return list.map((opt) => toFullOption(opt, baseProperties, labelMap));
  }
  function toFullOptionMap(optMap, baseProperties) {
    return Object.fromEntries(Object.entries(optMap).map(([k, v]) => [k, toFullOption(v, baseProperties)]));
  }
  var uniqByIdentifier = (originalArray) => {
    const names = /* @__PURE__ */ new Set();
    const newArray = [];
    for (const el of originalArray) if (!names.has(el.value ?? el.name)) {
      names.add(el.value ?? el.name);
      newArray.push(el);
    }
    return originalArray.length === newArray.length ? originalArray : newArray;
  };
  var isOptionGroupArray = (arr) => Array.isArray(arr) && arr.length > 0 && isPojo(arr[0]) && "options" in arr[0] && Array.isArray(arr[0].options);
  var isFlexibleOptionArray = (arr) => {
    let isFOA = false;
    if (Array.isArray(arr)) for (const o of arr) if (isOptionWithName(o) || isOptionWithValue(o)) isFOA = true;
    else return false;
    return isFOA;
  };
  var isFlexibleOptionGroupArray = (arr, { allowEmpty = false } = {}) => {
    let isFOGA = false;
    if (Array.isArray(arr)) for (const og of arr) if (isPojo(og) && "options" in og && (isFlexibleOptionArray(og.options) || allowEmpty && Array.isArray(og.options) && og.options.length === 0)) isFOGA = true;
    else return false;
    return isFOGA;
  };
  function getOption(arr, name) {
    return (isFlexibleOptionGroupArray(arr, { allowEmpty: true }) ? arr.flatMap((og) => og.options) : arr).find((op) => op.value === name || op.name === name);
  }
  function getFirstOption(arr) {
    if (!Array.isArray(arr) || arr.length === 0) return null;
    else if (isFlexibleOptionGroupArray(arr, { allowEmpty: true })) {
      for (const og of arr) if (og.options.length > 0) return og.options[0].value ?? og.options[0].name;
      return null;
    }
    return arr[0].value ?? arr[0].name;
  }
  var uniqOptGroups = (originalArray) => {
    const labels = /* @__PURE__ */ new Set();
    const names = /* @__PURE__ */ new Set();
    const newArray = [];
    for (const el of originalArray) if (!labels.has(el.label)) {
      labels.add(el.label);
      const optionsForThisGroup = [];
      for (const opt of el.options) if (!names.has(opt.value ?? opt.name)) {
        names.add(opt.value ?? opt.name);
        optionsForThisGroup.push(toFullOption(opt));
      }
      newArray.push({
        ...el,
        options: optionsForThisGroup
      });
    }
    return newArray;
  };
  var prepareOptionList = (props) => {
    const { optionList: optionListPropOriginal, baseOption = {}, labelMap = {}, placeholder: { placeholderName = "~", placeholderLabel = defaultPlaceholderLabel, placeholderGroupLabel = defaultPlaceholderLabel } = {}, autoSelectOption = true } = props;
    const defaultOption = {
      id: placeholderName,
      name: placeholderName,
      value: placeholderName,
      label: placeholderLabel
    };
    const optionsProp = optionListPropOriginal ?? [defaultOption];
    let optionList;
    const opts = Array.isArray(optionsProp) ? toFullOptionList(optionsProp, baseOption, labelMap) : objectKeys(toFullOptionMap(optionsProp, baseOption)).map((opt) => ({
      ...optionsProp[opt],
      name: opt,
      value: opt
    })).sort((a, b) => a.label.localeCompare(b.label));
    if (isFlexibleOptionGroupArray(opts)) optionList = autoSelectOption ? uniqOptGroups(opts) : uniqOptGroups([{
      label: placeholderGroupLabel,
      options: [defaultOption]
    }, ...opts]);
    else optionList = autoSelectOption ? uniqByIdentifier(opts) : uniqByIdentifier([defaultOption, ...opts]);
    let optionsMap = {};
    if (!Array.isArray(optionsProp)) {
      const op = toFullOptionMap(optionsProp, baseOption);
      optionsMap = autoSelectOption ? op : {
        ...op,
        [placeholderName]: defaultOption
      };
    } else if (isFlexibleOptionGroupArray(optionList)) for (const og of optionList) for (const opt of og.options) optionsMap[opt.value ?? opt.name] = toFullOption(opt, baseOption);
    else for (const opt of optionList) optionsMap[opt.value ?? opt.name] = toFullOption(opt, baseOption);
    return {
      defaultOption,
      optionList,
      optionsMap
    };
  };
  var filterByComparator = (field, operator, fieldToCompare) => {
    const fullField = toFullOption(field);
    const fullFieldToCompare = toFullOption(fieldToCompare);
    if (fullField.value === fullFieldToCompare.value) return false;
    if (typeof fullField.comparator === "string") return fullField[fullField.comparator] === fullFieldToCompare[fullField.comparator];
    return fullField.comparator?.(fullFieldToCompare, operator) ?? false;
  };
  var filterFieldsByComparator = (field, fields, operator) => {
    if (!field.comparator) {
      const filterOutSameField = (f) => (f.value ?? f.name) !== (field.value ?? field.name);
      if (isFlexibleOptionGroupArray(fields)) return fields.map((og) => ({
        ...og,
        options: og.options.filter((v) => filterOutSameField(v))
      }));
      return fields.filter((v) => filterOutSameField(v));
    }
    if (isFlexibleOptionGroupArray(fields)) return fields.map((og) => ({
      ...og,
      options: og.options.filter((f) => filterByComparator(field, operator, f))
    })).filter((og) => og.options.length > 0);
    return fields.filter((f) => filterByComparator(field, operator, f));
  };
  var parseNumber = (val, { parseNumbers, bigIntOnOverflow } = {}) => {
    if (!parseNumbers || typeof val === "bigint" || typeof val === "number") return val;
    if (parseNumbers === "native") return Number.parseFloat(val);
    const valAsNum = numericQuantity(val, {
      allowTrailingInvalid: parseNumbers === "enhanced",
      bigIntOnOverflow,
      romanNumerals: false,
      round: false
    });
    return typeof valAsNum === "bigint" || !Number.isNaN(valAsNum) ? valAsNum : val;
  };
  var remapProperties = (obj, propertyMap, deleteRemappedProperties) => {
    const result = {};
    for (const key in obj) {
      if (isUnsafeKey(key)) continue;
      const mappedKey = propertyMap[key];
      if (mappedKey === false) continue;
      if (mappedKey && key !== mappedKey) {
        if (!isUnsafeKey(mappedKey)) result[mappedKey] = obj[key];
        if (!deleteRemappedProperties) result[key] = obj[key];
      } else result[key] = obj[key];
    }
    return result;
  };
  function transformQuery(query, options = {}) {
    const { ruleProcessor = (r) => r, ruleGroupProcessor = (rg) => rg, propertyMap = {}, combinatorMap = {}, operatorMap = {}, omitPath = false, deleteRemappedProperties = true } = options;
    const processGroup = (rg) => ({
      ...ruleGroupProcessor(remapProperties({
        ...rg,
        ...isRuleGroupType(rg) ? { combinator: combinatorMap[rg.combinator] ?? rg.combinator } : {}
      }, propertyMap, deleteRemappedProperties)),
      ...propertyMap["rules"] === false ? null : { [propertyMap["rules"] ?? "rules"]: rg.rules.map((r, idx) => {
        const pathObject = omitPath ? null : { path: [...rg.path, idx] };
        if (typeof r === "string") return combinatorMap[r] ?? r;
        else if (isRuleGroup(r)) return processGroup({
          ...r,
          ...pathObject
        });
        return ruleProcessor(remapProperties({
          ...r,
          ...pathObject,
          ..."operator" in r ? { operator: operatorMap[r.operator] ?? r.operator } : {}
        }, propertyMap, deleteRemappedProperties));
      }) }
    });
    return processGroup({
      ...query,
      ...omitPath ? null : { path: [] }
    });
  }
  var isValidationResult = (vr) => isPojo(vr) && typeof vr.valid === "boolean";
  var isRuleOrGroupValid = (rg, validationResult, validator) => {
    if (rg.muted) return false;
    if (typeof validationResult === "boolean") return validationResult;
    if (isValidationResult(validationResult)) return validationResult.valid;
    if (typeof validator === "function" && !isRuleGroup(rg)) {
      const vr = validator(rg);
      if (typeof vr === "boolean") return vr;
      if (isValidationResult(vr)) return vr.valid;
    }
    return true;
  };
  var getParseNumberMethod = ({ parseNumbers, inputType }) => {
    if (typeof parseNumbers === "string") {
      const [method, level] = parseNumbers.split("-");
      if (level === "limited") return inputType === "number" ? method : false;
      return method;
    }
    return parseNumbers ? "strict" : false;
  };
  var mongoOperators = {
    "=": "$eq",
    "!=": "$ne",
    "<": "$lt",
    "<=": "$lte",
    ">": "$gt",
    ">=": "$gte",
    in: "$in",
    notin: "$nin",
    notIn: "$nin"
  };
  var celCombinatorMap = {
    and: "&&",
    or: "||"
  };
  var isValidValue = (value) => typeof value === "string" && value.length > 0 || typeof value === "number" && !Number.isNaN(value) || typeof value !== "string" && typeof value !== "number";
  var shouldRenderAsNumber = (value, parseNumbers) => !!parseNumbers && (typeof value === "number" || typeof value === "bigint" || typeof value === "string" && numericRegex2.test(value));
  var getQuoteFieldNamesWithArray = (quoteFieldNamesWith = ["", ""]) => Array.isArray(quoteFieldNamesWith) ? quoteFieldNamesWith : typeof quoteFieldNamesWith === "string" ? [quoteFieldNamesWith, quoteFieldNamesWith] : quoteFieldNamesWith ?? ["", ""];
  var getQuotedFieldName = (fieldName, { quoteFieldNamesWith, fieldIdentifierSeparator }) => {
    const [qPre, qPost] = getQuoteFieldNamesWithArray(quoteFieldNamesWith);
    return typeof fieldIdentifierSeparator === "string" && fieldIdentifierSeparator.length > 0 ? joinWith(splitBy(fieldName, fieldIdentifierSeparator).map((part) => `${qPre}${part}${qPost}`), fieldIdentifierSeparator) : `${qPre}${fieldName}${qPost}`;
  };
  var processMatchMode = (rule) => {
    const { mode, threshold } = rule.match ?? {};
    if (!mode) return null;
    if (!isRuleGroup(rule.value)) return false;
    const matchModeLC = lc(mode);
    const matchModeCoerced = matchModeLC === "atleast" && threshold === 1 ? "some" : matchModeLC === "atmost" && threshold === 0 ? "none" : matchModeLC;
    if ((matchModeCoerced === "atleast" || matchModeCoerced === "atmost" || matchModeCoerced === "exactly") && (typeof threshold !== "number" || threshold < 0)) return false;
    return {
      mode: matchModeCoerced,
      threshold
    };
  };
  var defaultRuleGroupProcessorCEL = (ruleGroup, options) => {
    const { fields, fallbackExpression, getParseNumberBoolean, placeholderFieldName, placeholderOperatorName, placeholderValueName, ruleProcessor, validateRule, validationMap } = options;
    const processRuleGroup = (rg, outermost) => {
      if (!isRuleOrGroupValid(rg, validationMap[rg.id ?? ""])) return outermost ? fallbackExpression : "";
      const processedRules = [];
      let precedingCombinator = "";
      let firstRule = true;
      for (const rule of rg.rules) {
        if (typeof rule === "string") {
          precedingCombinator = celCombinatorMap[rule];
          continue;
        }
        if (isRuleGroup(rule)) {
          const processedGroup = processRuleGroup(rule);
          if (processedGroup) {
            if (!firstRule && precedingCombinator) {
              processedRules.push(precedingCombinator);
              precedingCombinator = "";
            }
            firstRule = false;
            processedRules.push(processedGroup);
          }
          continue;
        }
        const [validationResult, fieldValidator] = validateRule(rule);
        if (!isRuleOrGroupValid(rule, validationResult, fieldValidator) || rule.field === placeholderFieldName || rule.operator === placeholderOperatorName || placeholderValueName !== void 0 && rule.value === placeholderValueName) continue;
        const fieldData = getOption(fields, rule.field);
        const processedRule = ruleProcessor(rule, {
          ...options,
          parseNumbers: getParseNumberBoolean(fieldData?.inputType),
          escapeQuotes: (rule.valueSource ?? "value") === "value",
          fieldData
        });
        if (processedRule) {
          if (!firstRule && precedingCombinator) {
            processedRules.push(precedingCombinator);
            precedingCombinator = "";
          }
          firstRule = false;
          processedRules.push(processedRule);
        }
      }
      const expression = processedRules.join(isRuleGroupType(rg) ? ` ${celCombinatorMap[rg.combinator]} ` : " ");
      const [prefix, suffix] = rg.not || !outermost ? [`${rg.not ? "!" : ""}(`, ")"] : ["", ""];
      return expression ? `${prefix}${expression}${suffix}` : fallbackExpression;
    };
    return processRuleGroup(ruleGroup, true);
  };
  var shouldNegate$2 = (op) => op.startsWith("not") || op.startsWith("doesnot");
  var escapeDoubleQuotes$1 = (v, escapeQuotes) => typeof v !== "string" || !escapeQuotes ? `${v}` : v.replaceAll(`"`, `\\"`);
  var defaultRuleProcessorCEL = (rule, opts = {}) => {
    const { escapeQuotes, parseNumbers, preserveValueOrder } = opts;
    const { field, operator, value, valueSource } = rule;
    const valueIsField = valueSource === "field";
    const operatorTL = lc(operator === "=" ? "==" : operator);
    const useBareValue = typeof value === "number" || typeof value === "boolean" || typeof value === "bigint" || shouldRenderAsNumber(value, parseNumbers);
    const matchEval = processMatchMode(rule);
    if (matchEval === false) return "";
    else if (matchEval) {
      const { mode, threshold } = matchEval;
      const arrayElementAlias = "elem_alias";
      const nestedArrayFilter = defaultRuleGroupProcessorCEL(transformQuery(rule.value, { ruleProcessor: (r) => ({
        ...r,
        field: `${arrayElementAlias}${r.field ? `.${r.field}` : ""}`
      }) }), opts);
      switch (mode) {
        case "all":
          return `${field}.all(${arrayElementAlias}, ${nestedArrayFilter})`;
        case "none":
        case "some":
          return `${mode === "none" ? "!" : ""}${field}.exists(${arrayElementAlias}, ${nestedArrayFilter})`;
        case "atleast":
        case "atmost":
        case "exactly": {
          const totalCount = `double(${field}.size())`;
          const filteredCount = `${field}.filter(${arrayElementAlias}, ${nestedArrayFilter}).size()`;
          const op = mode === "atleast" ? ">=" : mode === "atmost" ? "<=" : "==";
          if (threshold > 0 && threshold < 1) return `double(${filteredCount}) ${op} (${totalCount} * ${threshold})`;
          return `${filteredCount} ${op} ${threshold}`;
        }
      }
    }
    switch (operatorTL) {
      case "<":
      case "<=":
      case "==":
      case "!=":
      case ">":
      case ">=":
        return `${field} ${operatorTL} ${valueIsField || useBareValue ? trimIfString(value) : `"${escapeDoubleQuotes$1(value, escapeQuotes)}"`}`;
      case "contains":
      case "doesnotcontain":
        return `${shouldNegate$2(operatorTL) ? "!" : ""}${field}.contains(${valueIsField ? trimIfString(value) : `"${escapeDoubleQuotes$1(value, escapeQuotes)}"`})`;
      case "beginswith":
      case "doesnotbeginwith":
        return `${shouldNegate$2(operatorTL) ? "!" : ""}${field}.startsWith(${valueIsField ? trimIfString(value) : `"${escapeDoubleQuotes$1(value, escapeQuotes)}"`})`;
      case "endswith":
      case "doesnotendwith":
        return `${shouldNegate$2(operatorTL) ? "!" : ""}${field}.endsWith(${valueIsField ? trimIfString(value) : `"${escapeDoubleQuotes$1(value, escapeQuotes)}"`})`;
      case "null":
        return `${field} == null`;
      case "notnull":
        return `${field} != null`;
      case "in":
      case "notin": {
        const [prefix, suffix] = shouldNegate$2(operatorTL) ? ["!(", ")"] : ["", ""];
        return `${prefix}${field} in [${toArray(value).map((val) => valueIsField || shouldRenderAsNumber(val, parseNumbers) ? `${trimIfString(val)}` : `"${escapeDoubleQuotes$1(val, escapeQuotes)}"`).join(", ")}]${suffix}`;
      }
      case "between":
      case "notbetween": {
        const valueAsArray = toArray(value);
        if (valueAsArray.length >= 2 && !nullOrUndefinedOrEmpty(valueAsArray[0]) && !nullOrUndefinedOrEmpty(valueAsArray[1])) {
          const [first, second] = valueAsArray;
          const shouldParseNumbers = !(parseNumbers === false);
          const firstNum = shouldRenderAsNumber(first, shouldParseNumbers) ? parseNumber(first, { parseNumbers: shouldParseNumbers }) : NaN;
          const secondNum = shouldRenderAsNumber(second, shouldParseNumbers) ? parseNumber(second, { parseNumbers: shouldParseNumbers }) : NaN;
          let firstValue = Number.isNaN(firstNum) ? valueIsField ? `${first}` : `"${escapeDoubleQuotes$1(first, escapeQuotes)}"` : firstNum;
          let secondValue = Number.isNaN(secondNum) ? valueIsField ? `${second}` : `"${escapeDoubleQuotes$1(second, escapeQuotes)}"` : secondNum;
          if (!preserveValueOrder && firstValue === firstNum && secondValue === secondNum && secondNum < firstNum) {
            const tempNum = secondNum;
            secondValue = firstNum;
            firstValue = tempNum;
          }
          return operatorTL === "between" ? `(${field} >= ${firstValue} && ${field} <= ${secondValue})` : `(${field} < ${firstValue} || ${field} > ${secondValue})`;
        } else return "";
      }
    }
    return "";
  };
  var mongoDbFallback = { $and: [{ $expr: true }] };
  var defaultRuleGroupProcessorMongoDBQuery = (ruleGroup, options, meta) => {
    const { context, fields, getParseNumberBoolean, placeholderFieldName, placeholderOperatorName, placeholderValueName, ruleProcessor, validateRule, validationMap } = options;
    const { inExpressionContext } = context ?? {};
    const processRuleGroup = (rg, outermost) => {
      if (!isRuleOrGroupValid(rg, validationMap[rg.id ?? ""])) return outermost ? mongoDbFallback : false;
      const combinator = `$${lc(rg.combinator)}`;
      let hasChildRules = false;
      const expressions = rg.rules.map((rule) => {
        if (isRuleGroup(rule)) {
          const processedRuleGroup = processRuleGroup(rule);
          if (processedRuleGroup) {
            hasChildRules = true;
            return processedRuleGroup;
          }
          return false;
        }
        const [validationResult, fieldValidator] = validateRule(rule);
        if (!isRuleOrGroupValid(rule, validationResult, fieldValidator) || rule.field === placeholderFieldName || rule.operator === placeholderOperatorName || placeholderValueName !== void 0 && rule.value === placeholderValueName) return false;
        const fieldData = getOption(fields, rule.field);
        return ruleProcessor(rule, {
          ...options,
          parseNumbers: getParseNumberBoolean(fieldData?.inputType),
          fieldData
        }, meta);
      }).filter(Boolean);
      const result = expressions.length > 0 ? expressions.length === 1 && !hasChildRules ? expressions[0] : { [combinator]: expressions } : mongoDbFallback;
      return rg.not ? inExpressionContext ? { $not: result } : { $nor: [result] } : result;
    };
    return processRuleGroup(convertFromIC(ruleGroup), true);
  };
  var processNumber$1 = (value, fallback, parseNumbers = false) => shouldRenderAsNumber(value, parseNumbers || typeof value === "bigint") ? Number(parseNumber(value, { parseNumbers: "strict" })) : fallback;
  var defaultRuleProcessorMongoDBQuery = (rule, options = {}) => {
    const { field, operator, value, valueSource } = rule;
    const { parseNumbers, preserveValueOrder, context } = options;
    const valueIsField = valueSource === "field";
    const { avoidFieldsAsKeys } = context ?? {};
    const matchEval = processMatchMode(rule);
    if (matchEval === false) return;
    else if (matchEval) {
      const { mode, threshold } = matchEval;
      const totalCount = { $size: { $ifNull: [`$${field}`, []] } };
      const subQueryNoAggCtx = defaultRuleGroupProcessorMongoDBQuery(transformQuery(value, { ruleProcessor: (r) => ({
        ...r,
        field: r.field ? `${field}.${r.field}` : field
      }) }), {
        ...options,
        ruleProcessor: defaultRuleProcessorMongoDBQuery,
        context: {
          ...options.context,
          avoidFieldsAsKeys: false
        }
      });
      const subQueryWithAggCtx = defaultRuleGroupProcessorMongoDBQuery(transformQuery(value, { ruleProcessor: (r) => ({
        ...r,
        field: r.field ? `$item.${r.field}` : "$item"
      }) }), {
        ...options,
        ruleProcessor: defaultRuleProcessorMongoDBQuery,
        context: {
          ...options.context,
          avoidFieldsAsKeys: true,
          inExpressionContext: true
        }
      });
      const filteredCount = { $size: { $ifNull: [{ $filter: {
        input: `$${field}`,
        as: "item",
        cond: { $and: [subQueryWithAggCtx] }
      } }, []] } };
      switch (mode) {
        case "all":
          return { $expr: { $eq: [filteredCount, totalCount] } };
        case "none":
          return { $nor: [subQueryNoAggCtx] };
        case "some":
          return subQueryNoAggCtx;
        case "atleast":
        case "atmost":
        case "exactly": {
          const op = mode === "atleast" ? mongoOperators[">="] : mode === "atmost" ? mongoOperators["<="] : mongoOperators["="];
          if (threshold > 0 && threshold < 1) return { $expr: { [op]: [filteredCount, { $multiply: [totalCount, threshold] }] } };
          return { $expr: { [op]: [filteredCount, threshold] } };
        }
      }
    }
    if (operator === "=" && !valueIsField) return avoidFieldsAsKeys ? { $eq: [`$${field}`, processNumber$1(value, value, parseNumbers)] } : { [field]: processNumber$1(value, value, parseNumbers) };
    const operatorLC = lc(operator);
    switch (operatorLC) {
      case "<":
      case "<=":
      case "=":
      case "!=":
      case ">":
      case ">=": {
        const mongoOperator = mongoOperators[operatorLC];
        return valueIsField ? { [mongoOperator]: [`$${field}`, `$${value}`] } : avoidFieldsAsKeys ? { $and: [{ $ne: [`$${field}`, null] }, { [mongoOperator]: [`$${field}`, processNumber$1(value, value, parseNumbers)] }] } : { [field]: { [mongoOperator]: processNumber$1(value, value, parseNumbers) } };
      }
      case "contains":
        return valueIsField ? { $where: `this.${field}.includes(this.${value})` } : avoidFieldsAsKeys ? { $regexMatch: {
          input: `$${field}`,
          regex: value
        } } : { [field]: { $regex: value } };
      case "beginswith":
        return valueIsField ? { $where: `this.${field}.startsWith(this.${value})` } : avoidFieldsAsKeys ? { $regexMatch: {
          input: `$${field}`,
          regex: `^${value}`
        } } : { [field]: { $regex: `^${value}` } };
      case "endswith":
        return valueIsField ? { $where: `this.${field}.endsWith(this.${value})` } : avoidFieldsAsKeys ? { $regexMatch: {
          input: `$${field}`,
          regex: `${value}$`
        } } : { [field]: { $regex: `${value}$` } };
      case "doesnotcontain":
        return valueIsField ? { $where: `!this.${field}.includes(this.${value})` } : avoidFieldsAsKeys ? { $not: { $regexMatch: {
          input: `$${field}`,
          regex: value
        } } } : { [field]: { $not: { $regex: value } } };
      case "doesnotbeginwith":
        return valueIsField ? { $where: `!this.${field}.startsWith(this.${value})` } : avoidFieldsAsKeys ? { $not: { $regexMatch: {
          input: `$${field}`,
          regex: `^${value}`
        } } } : { [field]: { $not: { $regex: `^${value}` } } };
      case "doesnotendwith":
        return valueIsField ? { $where: `!this.${field}.endsWith(this.${value})` } : avoidFieldsAsKeys ? { $not: { $regexMatch: {
          input: `$${field}`,
          regex: `${value}$`
        } } } : { [field]: { $not: { $regex: `${value}$` } } };
      case "null":
        return avoidFieldsAsKeys ? { $eq: [`$${field}`, null] } : { [field]: null };
      case "notnull":
        return avoidFieldsAsKeys ? { $ne: [`$${field}`, null] } : { [field]: { $ne: null } };
      case "in":
      case "notin": {
        const valueAsArray = toArray(value);
        return valueIsField ? { $where: `${operatorLC === "notin" ? "!" : ""}[${valueAsArray.map((val) => `this.${val}`).join(",")}].includes(this.${field})` } : avoidFieldsAsKeys ? operatorLC === "notin" ? { $not: { [mongoOperators.in]: [`$${field}`, valueAsArray.map((val) => processNumber$1(val, val, parseNumbers))] } } : { [mongoOperators[operatorLC]]: [`$${field}`, valueAsArray.map((val) => processNumber$1(val, val, parseNumbers))] } : { [field]: { [mongoOperators[operatorLC]]: valueAsArray.map((val) => processNumber$1(val, val, parseNumbers)) } };
      }
      case "between":
      case "notbetween": {
        const valueAsArray = toArray(value);
        if (valueAsArray.length >= 2 && isValidValue(valueAsArray[0]) && isValidValue(valueAsArray[1])) {
          const [first, second] = valueAsArray;
          const firstNum = processNumber$1(first, NaN, true);
          const secondNum = processNumber$1(second, NaN, true);
          let firstValue = valueIsField ? first : Number.isNaN(firstNum) ? first : firstNum;
          let secondValue = valueIsField ? second : Number.isNaN(secondNum) ? second : secondNum;
          if (!preserveValueOrder && firstValue === firstNum && secondValue === secondNum && secondNum < firstNum) {
            const tempNum = secondNum;
            secondValue = firstNum;
            firstValue = tempNum;
          }
          if (operatorLC === "between") return valueIsField ? {
            $gte: [`$${field}`, `$${firstValue}`],
            $lte: [`$${field}`, `$${secondValue}`]
          } : avoidFieldsAsKeys ? { $and: [{ $gte: [`$${field}`, firstValue] }, { $lte: [`$${field}`, secondValue] }] } : { [field]: {
            $gte: firstValue,
            $lte: secondValue
          } };
          else return valueIsField ? { $or: [{ $lt: [`$${field}`, `$${firstValue}`] }, { $gt: [`$${field}`, `$${secondValue}`] }] } : avoidFieldsAsKeys ? { $or: [{ $lt: [`$${field}`, firstValue] }, { $gt: [`$${field}`, secondValue] }] } : { $or: [{ [field]: { $lt: firstValue } }, { [field]: { $gt: secondValue } }] };
        } else return "";
      }
    }
    return "";
  };
  var defaultRuleProcessorMongoDB = (rule, options) => {
    const queryObj = defaultRuleProcessorMongoDBQuery(rule, options);
    return queryObj ? JSON.stringify(queryObj) : "";
  };
  var defaultRuleGroupProcessorSpEL = (ruleGroup, options) => {
    const { fields, fallbackExpression, getParseNumberBoolean, placeholderFieldName, placeholderOperatorName, placeholderValueName, ruleProcessor, validateRule, validationMap } = options;
    const processRuleGroup = (rg, outermost) => {
      if (!isRuleOrGroupValid(rg, validationMap[rg.id ?? ""])) return outermost ? fallbackExpression : "";
      const processedRules = [];
      let precedingCombinator = "";
      let firstRule = true;
      for (const rule of rg.rules) {
        if (typeof rule === "string") {
          precedingCombinator = rule;
          continue;
        }
        if (isRuleGroup(rule)) {
          const processedGroup = processRuleGroup(rule);
          if (processedGroup) {
            if (!firstRule && precedingCombinator) {
              processedRules.push(precedingCombinator);
              precedingCombinator = "";
            }
            firstRule = false;
            processedRules.push(processedGroup);
          }
          continue;
        }
        const [validationResult, fieldValidator] = validateRule(rule);
        if (!isRuleOrGroupValid(rule, validationResult, fieldValidator) || rule.field === placeholderFieldName || rule.operator === placeholderOperatorName || placeholderValueName !== void 0 && rule.value === placeholderValueName) continue;
        const fieldData = getOption(fields, rule.field);
        const processedRule = ruleProcessor(rule, {
          ...options,
          parseNumbers: getParseNumberBoolean(fieldData?.inputType),
          escapeQuotes: (rule.valueSource ?? "value") === "value",
          fieldData
        });
        if (processedRule) {
          if (!firstRule && precedingCombinator) {
            processedRules.push(precedingCombinator);
            precedingCombinator = "";
          }
          firstRule = false;
          processedRules.push(processedRule);
        }
      }
      const expression = processedRules.join(isRuleGroupType(rg) ? ` ${rg.combinator} ` : " ");
      const [prefix, suffix] = rg.not || !outermost ? [`${rg.not ? "!" : ""}(`, ")"] : ["", ""];
      return expression ? `${prefix}${expression}${suffix}` : fallbackExpression;
    };
    return processRuleGroup(ruleGroup, true);
  };
  var shouldNegate$1 = (op) => op.startsWith("not") || op.startsWith("doesnot");
  var wrapInNegation = (clause, negate) => negate ? `!(${clause})` : clause;
  var escapeSingleQuotes$2 = (v, escapeQuotes) => typeof v !== "string" || !escapeQuotes ? `${v}` : v.replaceAll(`'`, `\\'`);
  var defaultRuleProcessorSpEL = (rule, opts = {}) => {
    const { field, operator, value, valueSource } = rule;
    const { escapeQuotes, parseNumbers, preserveValueOrder } = opts;
    const valueIsField = valueSource === "field";
    const operatorTL = lc(operator === "=" ? "==" : operator);
    const useBareValue = typeof value === "number" || typeof value === "boolean" || typeof value === "bigint" || shouldRenderAsNumber(value, parseNumbers);
    const matchEval = processMatchMode(rule);
    if (matchEval === false) return "";
    else if (matchEval) {
      const { mode, threshold } = matchEval;
      const nestedArrayFilter = defaultRuleGroupProcessorSpEL(transformQuery(rule.value, { ruleProcessor: (r) => ({
        ...r,
        field: r.field || "#this"
      }) }), opts);
      const totalCount = `${field}.size()`;
      const filteredCount = `${field}.?[${nestedArrayFilter}].size()`;
      switch (mode) {
        case "all":
          return `${filteredCount} == ${totalCount}`;
        case "none":
          return `${filteredCount} == 0`;
        case "some":
          return `${filteredCount} >= 1`;
        case "atleast":
        case "atmost":
        case "exactly": {
          const op = mode === "atleast" ? ">=" : mode === "atmost" ? "<=" : "==";
          if (threshold > 0 && threshold < 1) return `${filteredCount} ${op} (${totalCount} * ${threshold})`;
          return `${filteredCount} ${op} ${threshold}`;
        }
      }
    }
    switch (operatorTL) {
      case "<":
      case "<=":
      case "==":
      case "!=":
      case ">":
      case ">=":
        return `${field} ${operatorTL} ${valueIsField || useBareValue ? trimIfString(value) : `'${escapeSingleQuotes$2(value, escapeQuotes)}'`}`;
      case "contains":
      case "doesnotcontain":
        return wrapInNegation(`${field} matches ${valueIsField || useBareValue ? trimIfString(value) : `'${escapeSingleQuotes$2(value, escapeQuotes)}'`}`, shouldNegate$1(operatorTL));
      case "beginswith":
      case "doesnotbeginwith":
        return wrapInNegation(`${field} matches ${valueIsField ? `'^'.concat(${trimIfString(value)})` : `'${typeof value === "string" && !value.startsWith("^") || useBareValue ? "^" : ""}${escapeSingleQuotes$2(value, escapeQuotes)}'`}`, shouldNegate$1(operatorTL));
      case "endswith":
      case "doesnotendwith":
        return wrapInNegation(`${field} matches ${valueIsField ? `${trimIfString(value)}.concat('$')` : `'${escapeSingleQuotes$2(value, escapeQuotes)}${typeof value === "string" && !value.endsWith("$") || useBareValue ? "$" : ""}'`}`, shouldNegate$1(operatorTL));
      case "null":
        return `${field} == null`;
      case "notnull":
        return `${field} != null`;
      case "in":
      case "notin": {
        const negate = shouldNegate$1(operatorTL) ? "!" : "";
        const valueAsArray = toArray(value);
        return valueAsArray.length > 0 ? `${negate}(${valueAsArray.map((val) => `${field} == ${valueIsField || shouldRenderAsNumber(val, parseNumbers) ? `${trimIfString(val)}` : `'${escapeSingleQuotes$2(val, escapeQuotes)}'`}`).join(" or ")})` : "";
      }
      case "between":
      case "notbetween": {
        const valueAsArray = toArray(value);
        if (valueAsArray.length >= 2 && !nullOrUndefinedOrEmpty(valueAsArray[0]) && !nullOrUndefinedOrEmpty(valueAsArray[1])) {
          const [first, second] = valueAsArray;
          const shouldParseNumbers = !(parseNumbers === false);
          const firstNum = shouldRenderAsNumber(first, shouldParseNumbers) ? parseNumber(first, { parseNumbers: shouldParseNumbers }) : NaN;
          const secondNum = shouldRenderAsNumber(second, shouldParseNumbers) ? parseNumber(second, { parseNumbers: shouldParseNumbers }) : NaN;
          let firstValue = Number.isNaN(firstNum) ? valueIsField ? `${first}` : `'${escapeSingleQuotes$2(first, escapeQuotes)}'` : firstNum;
          let secondValue = Number.isNaN(secondNum) ? valueIsField ? `${second}` : `'${escapeSingleQuotes$2(second, escapeQuotes)}'` : secondNum;
          if (!preserveValueOrder && firstValue === firstNum && secondValue === secondNum && secondNum < firstNum) {
            const tempNum = secondNum;
            secondValue = firstNum;
            firstValue = tempNum;
          }
          return operatorTL === "between" ? `(${field} >= ${firstValue} and ${field} <= ${secondValue})` : `(${field} < ${firstValue} or ${field} > ${secondValue})`;
        } else return "";
      }
    }
    return "";
  };
  var escapeStringValueQuotes$1 = (v, quoteChar, escapeQuotes) => escapeQuotes && typeof v === "string" ? v.replaceAll(`${quoteChar}`, `${quoteChar}${quoteChar}`) : v;
  var defaultValueProcessorByRule = ({ operator, value, valueSource }, { escapeQuotes, parseNumbers, preserveValueOrder, quoteFieldNamesWith, quoteValuesWith, concatOperator = "||", fieldIdentifierSeparator, wrapValueWith = ["", ""], translations } = {}) => {
    const valueIsField = valueSource === "field";
    const operatorLowerCase = lc(operator);
    const quoteChar = quoteValuesWith || "'";
    const quoteValue = (v) => `${wrapValueWith[0]}${quoteChar}${v}${quoteChar}${wrapValueWith[1]}`;
    const escapeValue = (v) => escapeStringValueQuotes$1(v, quoteChar, escapeQuotes);
    const wrapAndEscape = (v) => quoteValue(escapeValue(v));
    const wrapFieldName = (v) => getQuotedFieldName(v, {
      quoteFieldNamesWith,
      fieldIdentifierSeparator
    });
    const concat = (...values) => concatOperator.toUpperCase() === "CONCAT" ? `CONCAT(${values.join(", ")})` : values.join(` ${concatOperator} `);
    switch (operatorLowerCase) {
      case "null":
      case "notnull":
        return "";
      case "in":
      case "notin": {
        const valueAsArray = toArray(value);
        if (valueAsArray.length > 0) return `(${valueAsArray.map((v) => valueIsField ? wrapFieldName(v) : shouldRenderAsNumber(v, parseNumbers) ? `${trimIfString(v)}` : `${wrapAndEscape(v)}`).join(", ")})`;
        return "";
      }
      case "between":
      case "notbetween": {
        const valueAsArray = toArray(value, { retainEmptyStrings: true });
        if (valueAsArray.length < 2 || !isValidValue(valueAsArray[0]) || !isValidValue(valueAsArray[1])) return "";
        const [first, second] = valueAsArray;
        const firstNum = shouldRenderAsNumber(first, parseNumbers) ? parseNumber(first, { parseNumbers: "strict" }) : NaN;
        const secondNum = shouldRenderAsNumber(second, parseNumbers) ? parseNumber(second, { parseNumbers: "strict" }) : NaN;
        const firstValue = Number.isNaN(firstNum) ? valueIsField ? `${first}` : first : firstNum;
        const secondValue = Number.isNaN(secondNum) ? valueIsField ? `${second}` : second : secondNum;
        const valsOneAndTwoOnly = [firstValue, secondValue];
        if (!preserveValueOrder && firstValue === firstNum && secondValue === secondNum && secondNum < firstNum) {
          valsOneAndTwoOnly[0] = secondNum;
          valsOneAndTwoOnly[1] = firstNum;
        }
        return (valueIsField ? valsOneAndTwoOnly.map((v) => wrapFieldName(v)) : valsOneAndTwoOnly.every((v) => shouldRenderAsNumber(v, parseNumbers)) ? valsOneAndTwoOnly.map((v) => parseNumber(v, { parseNumbers: "strict" })) : valsOneAndTwoOnly.map((v) => wrapAndEscape(v))).join(` ${translations?.betweenAnd ?? translations?.and ?? "and"} `);
      }
      case "contains":
      case "doesnotcontain":
        return valueIsField ? concat(quoteValue("%"), wrapFieldName(value), quoteValue("%")) : quoteValue(`%${escapeValue(value)}%`);
      case "beginswith":
      case "doesnotbeginwith":
        return valueIsField ? concat(wrapFieldName(value), quoteValue("%")) : quoteValue(`${escapeValue(value)}%`);
      case "endswith":
      case "doesnotendwith":
        return valueIsField ? concat(quoteValue("%"), wrapFieldName(value)) : quoteValue(`%${escapeValue(value)}`);
    }
    if (typeof value === "boolean") return value ? "TRUE" : "FALSE";
    return valueIsField ? wrapFieldName(value) : shouldRenderAsNumber(value, parseNumbers) ? `${trimIfString(value)}` : `${wrapAndEscape(value)}`;
  };
  var sqlDialectPresets = {
    ansi: {},
    sqlite: { paramsKeepPrefix: true },
    oracle: {},
    mssql: {
      concatOperator: "+",
      quoteFieldNamesWith: ["[", "]"],
      fieldIdentifierSeparator: ".",
      paramPrefix: "@"
    },
    mysql: { concatOperator: "CONCAT" },
    postgresql: {
      quoteFieldNamesWith: '"',
      numberedParams: true,
      paramPrefix: "$"
    }
  };
  var formatQueryOptionPresets = { ...sqlDialectPresets };
  var generateValueProcessor = (vpbr) => (field, operator, value, valueSource) => vpbr({
    field,
    operator,
    value,
    valueSource
  }, { parseNumbers: false });
  var defaultValueProcessor = generateValueProcessor(defaultValueProcessorByRule);
  var defaultMongoDBValueProcessor = generateValueProcessor(defaultRuleProcessorMongoDB);
  var defaultCELValueProcessor = generateValueProcessor(defaultRuleProcessorCEL);
  var defaultSpELValueProcessor = generateValueProcessor(defaultRuleProcessorSpEL);
  var findPath = (path, query) => {
    let target = query;
    let level = 0;
    while (level < path.length && target && isRuleGroup(target)) {
      const t = target.rules[path[level]];
      target = typeof t === "string" ? null : t;
      level++;
    }
    return level < path.length ? null : target;
  };
  var findID = (id, query) => {
    if (query.id === id) return query;
    for (const rule of query.rules) {
      if (typeof rule === "string") continue;
      if (rule.id === id) return rule;
      else if (isRuleGroup(rule)) {
        const subRule = findID(id, rule);
        if (subRule) return subRule;
      }
    }
    return null;
  };
  var getPathOfID = (id, query) => {
    if (query.id === id) return [];
    const idx = query.rules.findIndex((r) => !(typeof r === "string") && r.id === id);
    if (idx >= 0) return [idx];
    for (const [i, r] of Object.entries(query.rules)) if (isRuleGroup(r)) {
      const subPath = getPathOfID(id, r);
      if (Array.isArray(subPath)) return [Number.parseInt(i), ...subPath];
    }
    return null;
  };
  var getParentPath = (path) => path.slice(0, -1);
  var pathsAreEqual = (path1, path2) => path1.length === path2.length && path1.every((val, idx) => val === path2[idx]);
  var getCommonAncestorPath = (path1, path2) => {
    const commonAncestorPath = [];
    const parentPath1 = getParentPath(path1);
    const parentPath2 = getParentPath(path2);
    let i = 0;
    while (i < parentPath1.length && i < parentPath2.length && parentPath1[i] === parentPath2[i]) {
      commonAncestorPath.push(parentPath2[i]);
      i++;
    }
    return commonAncestorPath;
  };
  var pathIsDisabled = (path, query) => {
    let disabled = !!query.disabled;
    let target = query;
    let level = 0;
    while (level < path.length && !disabled && isRuleGroup(target)) {
      const t = target.rules[path[level]];
      if (isPojo(t) && (isRuleGroup(t) || "field" in t && !!t.field)) {
        disabled = !!t.disabled;
        target = t;
      }
      level++;
    }
    return disabled;
  };
  var generateAccessibleDescription = (params) => pathsAreEqual([], params.path) ? `Query builder` : `Rule group at path ${params.path.join("-")}`;
  var cryptoModule = globalThis.crypto;
  var generateID = () => "00-0-4-2-000".replaceAll(/[^-]/g, (s) => ((Math.random() + Math.trunc(s)) * 65536 >> Number.parseInt(s)).toString(16).padStart(4, "0"));
  if (cryptoModule) {
    if (typeof cryptoModule.randomUUID === "function") generateID = () => cryptoModule.randomUUID();
    else if (typeof cryptoModule.getRandomValues === "function") {
      const position19vals = "89ab";
      const container = new Uint32Array(32);
      generateID = () => {
        cryptoModule.getRandomValues(container);
        let id = (container[0] % 16).toString(16);
        for (let i = 1; i < 32; i++) {
          if (i === 12) id = `${id}4`;
          else if (i === 16) id = `${id}${position19vals[container[17] % 4]}`;
          else id = `${id}${(container[i] % 16).toString(16)}`;
          if (i === 7 || i === 11 || i === 15 || i === 19) id = `${id}-`;
        }
        return id;
      };
    }
  }
  var dummyFD$1 = {
    name: "name",
    value: "name",
    matchModes: null,
    label: "label"
  };
  var getMatchModesUtil = (fieldData, getMatchModes) => {
    const fd = fieldData ? toFullOption(fieldData) : (
      /* v8 ignore next -- @preserve */
      dummyFD$1
    );
    let matchModes = fd.matchModes ?? false;
    if (!matchModes && getMatchModes) matchModes = getMatchModes(fd.value, { fieldData: fd });
    if (matchModes === true) return defaultMatchModes;
    else if (matchModes === false) return [];
    if (isFlexibleOptionArray(matchModes)) return toFullOptionList(matchModes);
    return matchModes?.map((mm) => defaultMatchModes.find((dmm) => dmm.value === lc(mm)) ?? {
      name: mm,
      value: mm,
      label: mm
    }) ?? [];
  };
  var getValidationClassNames = (validationResult) => {
    const valid = typeof validationResult === "boolean" ? validationResult : typeof validationResult === "object" && validationResult !== null ? validationResult.valid : null;
    return typeof valid === "boolean" ? valid ? standardClassnames.valid : standardClassnames.invalid : "";
  };
  var defaultValueSourcesArray = [{
    name: "value",
    value: "value",
    label: "value"
  }];
  var dummyFD = {
    name: "name",
    value: "name",
    valueSources: null,
    label: "label"
  };
  var getValueSourcesUtil = (fieldData, operator, getValueSources) => {
    const fd = fieldData ? toFullOption(fieldData) : dummyFD;
    let valueSourcesNEW = fd.valueSources ?? false;
    if (typeof valueSourcesNEW === "function") valueSourcesNEW = valueSourcesNEW(operator);
    if (!valueSourcesNEW && getValueSources) valueSourcesNEW = getValueSources(fd.value, operator, { fieldData: fd });
    if (!valueSourcesNEW) return defaultValueSourcesArray;
    if (isFlexibleOptionArray(valueSourcesNEW)) return toFullOptionList(valueSourcesNEW);
    return valueSourcesNEW.map((vs) => defaultValueSourcesArray.find((dmm) => dmm.value === lc(vs)) ?? {
      name: vs,
      value: vs,
      label: vs
    });
  };
  var mergeAnyTranslation = (el, keyPropContextMap, defaults) => {
    if (isUnsafeKey(el)) return void 0;
    const finalKeys = objectEntries(keyPropContextMap).map(([key, [pT, cT]]) => [key, pT ?? cT ?? defaults?.[el]?.[key]]).filter((k) => !isUnsafeKey(k[0]) && !!k[1]);
    if (finalKeys.length > 0 || defaults) {
      const defaultProperties = defaults?.[el] ?? {};
      const finalObject = Object.assign({}, defaultProperties, Object.fromEntries(finalKeys));
      return { [el]: finalObject };
    }
  };
  var joinClassnamesByName = (name, args) => clsx(args.map((c) => clsx(c?.[name])));
  var mergeClassnames = (...args) => ({
    queryBuilder: joinClassnamesByName("queryBuilder", args),
    ruleGroup: joinClassnamesByName("ruleGroup", args),
    header: joinClassnamesByName("header", args),
    body: joinClassnamesByName("body", args),
    combinators: joinClassnamesByName("combinators", args),
    addRule: joinClassnamesByName("addRule", args),
    addGroup: joinClassnamesByName("addGroup", args),
    cloneRule: joinClassnamesByName("cloneRule", args),
    cloneGroup: joinClassnamesByName("cloneGroup", args),
    removeGroup: joinClassnamesByName("removeGroup", args),
    rule: joinClassnamesByName("rule", args),
    fields: joinClassnamesByName("fields", args),
    operators: joinClassnamesByName("operators", args),
    value: joinClassnamesByName("value", args),
    removeRule: joinClassnamesByName("removeRule", args),
    notToggle: joinClassnamesByName("notToggle", args),
    shiftActions: joinClassnamesByName("shiftActions", args),
    dragHandle: joinClassnamesByName("dragHandle", args),
    lockRule: joinClassnamesByName("lockRule", args),
    lockGroup: joinClassnamesByName("lockGroup", args),
    muteRule: joinClassnamesByName("muteRule", args),
    muteGroup: joinClassnamesByName("muteGroup", args),
    muted: joinClassnamesByName("muted", args),
    valueSource: joinClassnamesByName("valueSource", args),
    actionElement: joinClassnamesByName("actionElement", args),
    valueSelector: joinClassnamesByName("valueSelector", args),
    betweenRules: joinClassnamesByName("betweenRules", args),
    valid: joinClassnamesByName("valid", args),
    invalid: joinClassnamesByName("invalid", args),
    dndDragging: joinClassnamesByName("dndDragging", args),
    dndOver: joinClassnamesByName("dndOver", args),
    dndCopy: joinClassnamesByName("dndCopy", args),
    dndGroup: joinClassnamesByName("dndGroup", args),
    dndDropNotAllowed: joinClassnamesByName("dndDropNotAllowed", args),
    dndPreviewPosition: joinClassnamesByName("dndPreviewPosition", args),
    dndHidden: joinClassnamesByName("dndHidden", args),
    disabled: joinClassnamesByName("disabled", args),
    valueListItem: joinClassnamesByName("valueListItem", args),
    matchMode: joinClassnamesByName("matchMode", args),
    matchThreshold: joinClassnamesByName("matchThreshold", args),
    branches: joinClassnamesByName("branches", args),
    hasSubQuery: joinClassnamesByName("hasSubQuery", args),
    loading: joinClassnamesByName("loading", args)
  });
  var preferPropDefaultTrue = (prop, context) => prop === false ? false : prop ? true : !(context === false);
  var preferPropDefaultFalse = (prop, context) => prop ? true : prop === false ? false : !!context;
  var preferProp = (def, prop, context, doNotFinalize) => !doNotFinalize ? def ? preferPropDefaultTrue(prop, context) : preferPropDefaultFalse(prop, context) : prop ?? context;
  var preferFlagProps = (props = {}, contextVals = {}, finalize2) => objectEntries(queryBuilderFlagDefaults).reduce((acc, [key, def]) => {
    acc[key] = preferProp(def, props[key], contextVals[key], !finalize2);
    return acc;
  }, {});
  var prepareRule = (rule, { idGenerator = generateID } = {}) => {
    const needsId = !rule.id;
    const hasMatchMode = processMatchMode(rule);
    if (!needsId && !hasMatchMode) return rule;
    return {
      ...rule,
      ...needsId && { id: idGenerator() },
      ...hasMatchMode && { value: prepareRuleGroup(rule.value, { idGenerator }) }
    };
  };
  var prepareRuleGroup = (queryObject, { idGenerator = generateID } = {}) => {
    const needsId = !queryObject.id;
    let rulesChanged = false;
    const newRules = [];
    for (let i = 0; i < queryObject.rules.length; i++) {
      const r = queryObject.rules[i];
      if (typeof r === "string") newRules.push(r);
      else {
        const prepared = isRuleGroup(r) ? prepareRuleGroup(r, { idGenerator }) : prepareRule(r, { idGenerator });
        newRules.push(prepared);
        if (prepared !== r) rulesChanged = true;
      }
    }
    if (!needsId && !rulesChanged) return queryObject;
    return {
      ...queryObject,
      ...needsId && { id: idGenerator() },
      rules: newRules
    };
  };
  var prepareRuleOrGroup = (rg, { idGenerator = generateID } = {}) => isRuleGroup(rg) ? prepareRuleGroup(rg, { idGenerator }) : prepareRule(rg, { idGenerator });
  var regenerateID = (rule, { idGenerator = generateID } = {}) => structuredClone({
    ...rule,
    id: idGenerator()
  });
  var regenerateIDs = (subject, { idGenerator = generateID } = {}) => {
    if (!isPojo(subject)) return subject;
    if (!isRuleGroup(subject)) return structuredClone({
      ...subject,
      id: idGenerator()
    });
    const newGroup = {
      ...subject,
      id: idGenerator()
    };
    if (Array.isArray(newGroup.rules)) newGroup.rules = subject.rules.map((r) => typeof r === "string" ? r : isRuleGroup(r) ? regenerateIDs(r, { idGenerator }) : regenerateID(r, { idGenerator }));
    return newGroup;
  };
  var add = (query, ruleOrGroup, parentPathOrID, options = {}) => produce(query, (q) => addInPlace(q, ruleOrGroup, parentPathOrID, options));
  var addInPlace = (query, ruleOrGroup, parentPathOrID, options = {}) => {
    const { combinators = defaultCombinators, combinatorPreceding, idGenerator = generateID } = options;
    const parent = Array.isArray(parentPathOrID) ? findPath(parentPathOrID, query) : findID(parentPathOrID, query);
    if (!parent || !isRuleGroup(parent)) return query;
    if (isRuleGroupTypeIC(parent) && parent.rules.length > 0) {
      const prevCombinator = parent.rules.at(-2);
      parent.rules.push(combinatorPreceding ?? (typeof prevCombinator === "string" ? prevCombinator : getFirstOption(combinators)));
    }
    parent.rules.push(prepareRuleOrGroup(ruleOrGroup, { idGenerator }));
    return query;
  };
  var update = (query, prop, value, pathOrID, options = {}) => produce(query, (q) => updateInPlace(q, prop, value, pathOrID, options));
  var updateInPlace = (query, prop, value, pathOrID, options = {}) => {
    const { resetOnFieldChange: _resetOnFieldChange = true, resetOnOperatorChange = false, getRuleDefaultOperator = () => "=", getValueSources = () => ["value"], getRuleDefaultValue = () => "", getMatchModes = () => [] } = options;
    let resetOnFieldChange = _resetOnFieldChange;
    const path = Array.isArray(pathOrID) ? pathOrID : getPathOfID(pathOrID, query);
    if (!path) return query;
    if (prop === "combinator" && !isRuleGroupType(query)) {
      const parentRules = findPath(getParentPath(path), query).rules;
      if (path.at(-1) % 2 === 1) parentRules[path.at(-1)] = value;
      return query;
    }
    const ruleOrGroup = findPath(path, query);
    if (!ruleOrGroup) return query;
    const isGroup = isRuleGroup(ruleOrGroup);
    if (ruleOrGroup[prop] === value) return query;
    if (prop !== "valueSource") ruleOrGroup[prop] = value;
    if (isGroup) return query;
    let resetValueSource = false;
    let resetValue = false;
    if (prop === "field") {
      const fromFieldMatchModes = getMatchModes(ruleOrGroup.field);
      const toFieldMatchModes = getMatchModes(value);
      if (toFieldMatchModes.length === 0) delete ruleOrGroup.match;
      else {
        const nextMatchMode = ruleOrGroup.match?.mode && getOption(toFieldMatchModes, ruleOrGroup.match.mode) ? null : getFirstOption(toFieldMatchModes);
        if (nextMatchMode) ruleOrGroup.match = {
          mode: nextMatchMode,
          threshold: 1
        };
      }
      if (fromFieldMatchModes.length > 0 || toFieldMatchModes.length > 0) resetOnFieldChange = true;
    }
    if (resetOnFieldChange && prop === "field") {
      ruleOrGroup.operator = getRuleDefaultOperator(value);
      resetValueSource = true;
      resetValue = true;
    }
    if (resetOnOperatorChange && prop === "operator") {
      resetValueSource = true;
      resetValue = true;
    }
    const defaultValueSource = getFirstOption(getValueSourcesUtil({
      name: ruleOrGroup.field,
      value: ruleOrGroup.field,
      label: ""
    }, ruleOrGroup.operator, getValueSources));
    if (resetValueSource && ruleOrGroup.valueSource && defaultValueSource !== ruleOrGroup.valueSource || prop === "valueSource" && value !== ruleOrGroup.valueSource) {
      resetValue = !!ruleOrGroup.valueSource || !ruleOrGroup.valueSource && value !== defaultValueSource;
      ruleOrGroup.valueSource = resetValueSource ? defaultValueSource : value;
    }
    if (resetValue) ruleOrGroup.value = getRuleDefaultValue(ruleOrGroup);
    return query;
  };
  var remove = (query, pathOrID) => produce(query, (q) => removeInPlace(q, pathOrID));
  var removeInPlace = (query, pathOrID) => {
    const path = Array.isArray(pathOrID) ? pathOrID : getPathOfID(pathOrID, query);
    if (!path || path.length === 0 || !isRuleGroupType(query) && !findPath(path, query)) return query;
    const index = path.at(-1);
    const parent = findPath(getParentPath(path), query);
    if (parent && isRuleGroup(parent)) if (!isRuleGroupType(parent) && parent.rules.length > 1) {
      const idxStartDelete = index === 0 ? 0 : index - 1;
      parent.rules.splice(idxStartDelete, 2);
    } else parent.rules.splice(index, 1);
    return query;
  };
  var getNextPath = (query, currentPath, newPathOrShiftDirection) => {
    if (Array.isArray(newPathOrShiftDirection)) return newPathOrShiftDirection;
    const ic = isRuleGroupTypeIC(query);
    if (newPathOrShiftDirection === "up") if (pathsAreEqual(currentPath, [0])) return currentPath;
    else if (currentPath.at(-1) === 0) {
      const parentPath = getParentPath(currentPath);
      return [...getParentPath(parentPath), Math.max(0, parentPath.at(-1) - (ic ? 1 : 0))];
    } else {
      const evaluationPath = [...getParentPath(currentPath), Math.max(0, currentPath.at(-1) - (ic ? 2 : 1))];
      const entityAtTarget = findPath(evaluationPath, query);
      if (isRuleGroup(entityAtTarget)) return [...evaluationPath, entityAtTarget.rules.length];
      else return [...getParentPath(currentPath), Math.max(0, currentPath.at(-1) - (ic ? 3 : 1))];
    }
    else if (newPathOrShiftDirection === "down") if (pathsAreEqual([query.rules.length - 1], currentPath)) return currentPath;
    else if (currentPath.at(-1) === findPath(getParentPath(currentPath), query).rules.length - 1) {
      const parentPath = getParentPath(currentPath);
      return [...getParentPath(parentPath), parentPath.at(-1) + 1];
    } else {
      const evaluationPath = [...getParentPath(currentPath), currentPath.at(-1) + (ic ? 2 : 1)];
      if (isRuleGroup(findPath(evaluationPath, query))) return [...evaluationPath, 0];
      else return [...getParentPath(currentPath), currentPath.at(-1) + (ic ? 3 : 2)];
    }
    return currentPath;
  };
  var move = (query, oldPathOrID, newPath, options = {}) => produce(query, (q) => moveInPlace(q, oldPathOrID, newPath, options));
  var moveInPlace = (query, oldPathOrID, newPath, options = {}) => {
    const { clone = false, combinators = defaultCombinators, idGenerator = generateID } = options;
    const oldPath = Array.isArray(oldPathOrID) ? oldPathOrID : getPathOfID(oldPathOrID, query);
    if (!oldPath) return query;
    const nextPath = getNextPath(query, oldPath, newPath);
    if (oldPath.length === 0 || pathsAreEqual(oldPath, nextPath) || !findPath(getParentPath(nextPath), query)) return query;
    const ruleOrGroupOriginal = findPath(oldPath, query);
    if (!ruleOrGroupOriginal) return query;
    const ruleOrGroup = clone ? regenerateIDs(isDraft(ruleOrGroupOriginal) ? current(ruleOrGroupOriginal) : ruleOrGroupOriginal, { idGenerator }) : ruleOrGroupOriginal;
    const independentCombinators = isRuleGroupTypeIC(query);
    const parentOfRuleToRemove = findPath(getParentPath(oldPath), query);
    const ruleToRemoveIndex = oldPath.at(-1);
    const oldPrevCombinator = independentCombinators && ruleToRemoveIndex > 0 ? parentOfRuleToRemove.rules[ruleToRemoveIndex - 1] : null;
    const oldNextCombinator = independentCombinators && ruleToRemoveIndex < parentOfRuleToRemove.rules.length - 1 ? parentOfRuleToRemove.rules[ruleToRemoveIndex + 1] : null;
    if (!clone) {
      const idxStartDelete = independentCombinators ? Math.max(0, ruleToRemoveIndex - 1) : ruleToRemoveIndex;
      const deleteLength = independentCombinators ? 2 : 1;
      parentOfRuleToRemove.rules.splice(idxStartDelete, deleteLength);
    }
    const newNewPath = [...nextPath];
    const commonAncestorPath = getCommonAncestorPath(oldPath, nextPath);
    if (!clone && oldPath.length === commonAncestorPath.length + 1 && nextPath[commonAncestorPath.length] > oldPath[commonAncestorPath.length]) newNewPath[commonAncestorPath.length] -= independentCombinators ? 2 : 1;
    const parentToInsertInto = findPath(getParentPath(newNewPath), query);
    const newIndex = newNewPath.at(-1);
    const insertRuleOrGroup = (...args) => parentToInsertInto.rules.splice(newIndex, 0, ...args);
    if (parentToInsertInto.rules.length === 0 || !independentCombinators) insertRuleOrGroup(ruleOrGroup);
    else if (newIndex === 0) if (ruleToRemoveIndex === 0 && oldNextCombinator) insertRuleOrGroup(ruleOrGroup, oldNextCombinator);
    else insertRuleOrGroup(ruleOrGroup, parentToInsertInto.rules[1] ?? oldPrevCombinator ?? getFirstOption(combinators));
    else if (oldPrevCombinator) insertRuleOrGroup(oldPrevCombinator, ruleOrGroup);
    else insertRuleOrGroup(parentToInsertInto.rules[newIndex - 2] ?? oldNextCombinator ?? getFirstOption(combinators), ruleOrGroup);
    return query;
  };
  var group = (query, sourcePathOrID, targetPathOrID, options = {}) => produce(query, (q) => groupInPlace(q, sourcePathOrID, targetPathOrID, options));
  var groupInPlace = (query, sourcePathOrID, targetPathOrID, options = {}) => {
    const { clone = false, combinators = defaultCombinators, idGenerator = generateID } = options;
    const sourcePath = Array.isArray(sourcePathOrID) ? sourcePathOrID : getPathOfID(sourcePathOrID, query);
    const targetPath = Array.isArray(targetPathOrID) ? targetPathOrID : getPathOfID(targetPathOrID, query);
    if (!sourcePath || !targetPath) return query;
    const nextPath = getNextPath(query, sourcePath, targetPath);
    if (sourcePath.length === 0 || pathsAreEqual(sourcePath, nextPath) || !findPath(getParentPath(nextPath), query)) return query;
    const sourceRuleOrGroupOriginal = findPath(sourcePath, query);
    const targetRuleOrGroup = findPath(targetPath, query);
    if (!sourceRuleOrGroupOriginal || !targetRuleOrGroup) return query;
    const sourceRuleOrGroup = clone ? regenerateIDs(isDraft(sourceRuleOrGroupOriginal) ? current(sourceRuleOrGroupOriginal) : sourceRuleOrGroupOriginal, { idGenerator }) : sourceRuleOrGroupOriginal;
    const independentCombinators = isRuleGroupTypeIC(query);
    const parentOfRuleToRemove = findPath(getParentPath(sourcePath), query);
    const ruleToRemoveIndex = sourcePath.at(-1);
    if (!clone) {
      const idxStartDelete = independentCombinators ? Math.max(0, ruleToRemoveIndex - 1) : ruleToRemoveIndex;
      const deleteLength = independentCombinators ? 2 : 1;
      parentOfRuleToRemove.rules.splice(idxStartDelete, deleteLength);
    }
    const newNewPath = [...nextPath];
    const commonAncestorPath = getCommonAncestorPath(sourcePath, nextPath);
    if (!clone && sourcePath.length === commonAncestorPath.length + 1 && nextPath[commonAncestorPath.length] > sourcePath[commonAncestorPath.length]) newNewPath[commonAncestorPath.length] -= independentCombinators ? 2 : 1;
    const parentOfTargetPath = findPath(getParentPath(newNewPath), query);
    const targetPathIndex = newNewPath.at(-1);
    parentOfTargetPath.rules.splice(targetPathIndex, 1, prepareRuleOrGroup(independentCombinators ? { rules: [
      targetRuleOrGroup,
      getFirstOption(combinators),
      sourceRuleOrGroup
    ] } : {
      combinator: getFirstOption(combinators),
      rules: [targetRuleOrGroup, sourceRuleOrGroup]
    }, { idGenerator }));
    return query;
  };

  // node_modules/react-querybuilder/dist/defaults-g6J_xYY8.mjs
  init_react_global_shim();
  init_react_global_shim();

  // node_modules/redux/dist/redux.mjs
  function formatProdErrorMessage(code) {
    return `Minified Redux error #${code}; visit https://redux.js.org/Errors?code=${code} for the full message or use the non-minified dev environment for full errors. `;
  }
  var $$observable = /* @__PURE__ */ (() => typeof Symbol === "function" && Symbol.observable || "@@observable")();
  var symbol_observable_default = $$observable;
  var randomString = () => Math.random().toString(36).substring(7).split("").join(".");
  var ActionTypes = {
    INIT: `@@redux/INIT${/* @__PURE__ */ randomString()}`,
    REPLACE: `@@redux/REPLACE${/* @__PURE__ */ randomString()}`,
    PROBE_UNKNOWN_ACTION: () => `@@redux/PROBE_UNKNOWN_ACTION${randomString()}`
  };
  var actionTypes_default = ActionTypes;
  function isPlainObject2(obj) {
    if (typeof obj !== "object" || obj === null)
      return false;
    let proto = obj;
    while (Object.getPrototypeOf(proto) !== null) {
      proto = Object.getPrototypeOf(proto);
    }
    return Object.getPrototypeOf(obj) === proto || Object.getPrototypeOf(obj) === null;
  }
  function createStore(reducer, preloadedState, enhancer) {
    if (typeof reducer !== "function") {
      throw new Error(true ? formatProdErrorMessage(2) : `Expected the root reducer to be a function. Instead, received: '${kindOf(reducer)}'`);
    }
    if (typeof preloadedState === "function" && typeof enhancer === "function" || typeof enhancer === "function" && typeof arguments[3] === "function") {
      throw new Error(true ? formatProdErrorMessage(0) : "It looks like you are passing several store enhancers to createStore(). This is not supported. Instead, compose them together to a single function. See https://redux.js.org/tutorials/fundamentals/part-4-store#creating-a-store-with-enhancers for an example.");
    }
    if (typeof preloadedState === "function" && typeof enhancer === "undefined") {
      enhancer = preloadedState;
      preloadedState = void 0;
    }
    if (typeof enhancer !== "undefined") {
      if (typeof enhancer !== "function") {
        throw new Error(true ? formatProdErrorMessage(1) : `Expected the enhancer to be a function. Instead, received: '${kindOf(enhancer)}'`);
      }
      return enhancer(createStore)(reducer, preloadedState);
    }
    let currentReducer = reducer;
    let currentState = preloadedState;
    let currentListeners = /* @__PURE__ */ new Map();
    let nextListeners = currentListeners;
    let listenerIdCounter = 0;
    let isDispatching = false;
    function ensureCanMutateNextListeners() {
      if (nextListeners === currentListeners) {
        nextListeners = /* @__PURE__ */ new Map();
        currentListeners.forEach((listener2, key) => {
          nextListeners.set(key, listener2);
        });
      }
    }
    function getState() {
      if (isDispatching) {
        throw new Error(true ? formatProdErrorMessage(3) : "You may not call store.getState() while the reducer is executing. The reducer has already received the state as an argument. Pass it down from the top reducer instead of reading it from the store.");
      }
      return currentState;
    }
    function subscribe(listener2) {
      if (typeof listener2 !== "function") {
        throw new Error(true ? formatProdErrorMessage(4) : `Expected the listener to be a function. Instead, received: '${kindOf(listener2)}'`);
      }
      if (isDispatching) {
        throw new Error(true ? formatProdErrorMessage(5) : "You may not call store.subscribe() while the reducer is executing. If you would like to be notified after the store has been updated, subscribe from a component and invoke store.getState() in the callback to access the latest state. See https://redux.js.org/api/store#subscribelistener for more details.");
      }
      let isSubscribed = true;
      ensureCanMutateNextListeners();
      const listenerId = listenerIdCounter++;
      nextListeners.set(listenerId, listener2);
      return function unsubscribe() {
        if (!isSubscribed) {
          return;
        }
        if (isDispatching) {
          throw new Error(true ? formatProdErrorMessage(6) : "You may not unsubscribe from a store listener while the reducer is executing. See https://redux.js.org/api/store#subscribelistener for more details.");
        }
        isSubscribed = false;
        ensureCanMutateNextListeners();
        nextListeners.delete(listenerId);
        currentListeners = null;
      };
    }
    function dispatch(action) {
      if (!isPlainObject2(action)) {
        throw new Error(true ? formatProdErrorMessage(7) : `Actions must be plain objects. Instead, the actual type was: '${kindOf(action)}'. You may need to add middleware to your store setup to handle dispatching other values, such as 'redux-thunk' to handle dispatching functions. See https://redux.js.org/tutorials/fundamentals/part-4-store#middleware and https://redux.js.org/tutorials/fundamentals/part-6-async-logic#using-the-redux-thunk-middleware for examples.`);
      }
      if (typeof action.type === "undefined") {
        throw new Error(true ? formatProdErrorMessage(8) : 'Actions may not have an undefined "type" property. You may have misspelled an action type string constant.');
      }
      if (typeof action.type !== "string") {
        throw new Error(true ? formatProdErrorMessage(17) : `Action "type" property must be a string. Instead, the actual type was: '${kindOf(action.type)}'. Value was: '${action.type}' (stringified)`);
      }
      if (isDispatching) {
        throw new Error(true ? formatProdErrorMessage(9) : "Reducers may not dispatch actions.");
      }
      try {
        isDispatching = true;
        currentState = currentReducer(currentState, action);
      } finally {
        isDispatching = false;
      }
      const listeners = currentListeners = nextListeners;
      listeners.forEach((listener2) => {
        listener2();
      });
      return action;
    }
    function replaceReducer(nextReducer) {
      if (typeof nextReducer !== "function") {
        throw new Error(true ? formatProdErrorMessage(10) : `Expected the nextReducer to be a function. Instead, received: '${kindOf(nextReducer)}`);
      }
      currentReducer = nextReducer;
      dispatch({
        type: actionTypes_default.REPLACE
      });
    }
    function observable() {
      const outerSubscribe = subscribe;
      return {
        /**
         * The minimal observable subscription method.
         * @param observer Any object that can be used as an observer.
         * The observer object should have a `next` method.
         * @returns An object with an `unsubscribe` method that can
         * be used to unsubscribe the observable from the store, and prevent further
         * emission of values from the observable.
         */
        subscribe(observer) {
          if (typeof observer !== "object" || observer === null) {
            throw new Error(true ? formatProdErrorMessage(11) : `Expected the observer to be an object. Instead, received: '${kindOf(observer)}'`);
          }
          function observeState() {
            const observerAsObserver = observer;
            if (observerAsObserver.next) {
              observerAsObserver.next(getState());
            }
          }
          observeState();
          const unsubscribe = outerSubscribe(observeState);
          return {
            unsubscribe
          };
        },
        [symbol_observable_default]() {
          return this;
        }
      };
    }
    dispatch({
      type: actionTypes_default.INIT
    });
    const store = {
      dispatch,
      subscribe,
      getState,
      replaceReducer,
      [symbol_observable_default]: observable
    };
    return store;
  }
  function assertReducerShape(reducers) {
    Object.keys(reducers).forEach((key) => {
      const reducer = reducers[key];
      const initialState = reducer(void 0, {
        type: actionTypes_default.INIT
      });
      if (typeof initialState === "undefined") {
        throw new Error(true ? formatProdErrorMessage(12) : `The slice reducer for key "${key}" returned undefined during initialization. If the state passed to the reducer is undefined, you must explicitly return the initial state. The initial state may not be undefined. If you don't want to set a value for this reducer, you can use null instead of undefined.`);
      }
      if (typeof reducer(void 0, {
        type: actionTypes_default.PROBE_UNKNOWN_ACTION()
      }) === "undefined") {
        throw new Error(true ? formatProdErrorMessage(13) : `The slice reducer for key "${key}" returned undefined when probed with a random type. Don't try to handle '${actionTypes_default.INIT}' or other actions in "redux/*" namespace. They are considered private. Instead, you must return the current state for any unknown actions, unless it is undefined, in which case you must return the initial state, regardless of the action type. The initial state may not be undefined, but can be null.`);
      }
    });
  }
  function combineReducers(reducers) {
    const reducerKeys = Object.keys(reducers);
    const finalReducers = {};
    for (let i = 0; i < reducerKeys.length; i++) {
      const key = reducerKeys[i];
      if (false) {
        if (typeof reducers[key] === "undefined") {
          warning(`No reducer provided for key "${key}"`);
        }
      }
      if (typeof reducers[key] === "function") {
        finalReducers[key] = reducers[key];
      }
    }
    const finalReducerKeys = Object.keys(finalReducers);
    let unexpectedKeyCache;
    if (false) {
      unexpectedKeyCache = {};
    }
    let shapeAssertionError;
    try {
      assertReducerShape(finalReducers);
    } catch (e) {
      shapeAssertionError = e;
    }
    return function combination(state = {}, action) {
      if (shapeAssertionError) {
        throw shapeAssertionError;
      }
      if (false) {
        const warningMessage = getUnexpectedStateShapeWarningMessage(state, finalReducers, action, unexpectedKeyCache);
        if (warningMessage) {
          warning(warningMessage);
        }
      }
      let hasChanged = false;
      const nextState = {};
      for (let i = 0; i < finalReducerKeys.length; i++) {
        const key = finalReducerKeys[i];
        const reducer = finalReducers[key];
        const previousStateForKey = state[key];
        const nextStateForKey = reducer(previousStateForKey, action);
        if (typeof nextStateForKey === "undefined") {
          const actionType = action && action.type;
          throw new Error(true ? formatProdErrorMessage(14) : `When called with an action of type ${actionType ? `"${String(actionType)}"` : "(unknown type)"}, the slice reducer for key "${key}" returned undefined. To ignore an action, you must explicitly return the previous state. If you want this reducer to hold no value, you can return null instead of undefined.`);
        }
        nextState[key] = nextStateForKey;
        hasChanged = hasChanged || nextStateForKey !== previousStateForKey;
      }
      hasChanged = hasChanged || finalReducerKeys.length !== Object.keys(state).length;
      return hasChanged ? nextState : state;
    };
  }
  function compose(...funcs) {
    if (funcs.length === 0) {
      return (arg) => arg;
    }
    if (funcs.length === 1) {
      return funcs[0];
    }
    return funcs.reduce((a, b) => (...args) => a(b(...args)));
  }
  function applyMiddleware(...middlewares) {
    return (createStore2) => (reducer, preloadedState) => {
      const store = createStore2(reducer, preloadedState);
      let dispatch = () => {
        throw new Error(true ? formatProdErrorMessage(15) : "Dispatching while constructing your middleware is not allowed. Other middleware would not be applied to this dispatch.");
      };
      const middlewareAPI = {
        getState: store.getState,
        dispatch: (action, ...args) => dispatch(action, ...args)
      };
      const chain = middlewares.map((middleware) => middleware(middlewareAPI));
      dispatch = compose(...chain)(store.dispatch);
      return {
        ...store,
        dispatch
      };
    };
  }
  function isAction(action) {
    return isPlainObject2(action) && "type" in action && typeof action.type === "string";
  }

  // node_modules/redux-thunk/dist/redux-thunk.mjs
  function createThunkMiddleware(extraArgument) {
    const middleware = ({ dispatch, getState }) => (next) => (action) => {
      if (typeof action === "function") {
        return action(dispatch, getState, extraArgument);
      }
      return next(action);
    };
    return middleware;
  }
  var thunk = createThunkMiddleware();
  var withExtraArgument = createThunkMiddleware;

  // node_modules/@reduxjs/toolkit/dist/redux-toolkit.modern.mjs
  var composeWithDevTools = typeof window !== "undefined" && window.__REDUX_DEVTOOLS_EXTENSION_COMPOSE__ ? window.__REDUX_DEVTOOLS_EXTENSION_COMPOSE__ : function() {
    if (arguments.length === 0) return void 0;
    if (typeof arguments[0] === "object") return compose;
    return compose.apply(null, arguments);
  };
  var devToolsEnhancer = typeof window !== "undefined" && window.__REDUX_DEVTOOLS_EXTENSION__ ? window.__REDUX_DEVTOOLS_EXTENSION__ : function() {
    return function(noop3) {
      return noop3;
    };
  };
  var hasMatchFunction = (v) => {
    return v && typeof v.match === "function";
  };
  function createAction(type, prepareAction) {
    function actionCreator(...args) {
      if (prepareAction) {
        let prepared = prepareAction(...args);
        if (!prepared) {
          throw new Error(true ? formatProdErrorMessage2(0) : "prepareAction did not return an object");
        }
        return {
          type,
          payload: prepared.payload,
          ..."meta" in prepared && {
            meta: prepared.meta
          },
          ..."error" in prepared && {
            error: prepared.error
          }
        };
      }
      return {
        type,
        payload: args[0]
      };
    }
    actionCreator.toString = () => `${type}`;
    actionCreator.type = type;
    actionCreator.match = (action) => isAction(action) && action.type === type;
    return actionCreator;
  }
  var Tuple = class _Tuple extends Array {
    constructor(...items) {
      super(...items);
      Object.setPrototypeOf(this, _Tuple.prototype);
    }
    static get [Symbol.species]() {
      return _Tuple;
    }
    concat(...arr) {
      return super.concat.apply(this, arr);
    }
    prepend(...arr) {
      if (arr.length === 1 && Array.isArray(arr[0])) {
        return new _Tuple(...arr[0].concat(this));
      }
      return new _Tuple(...arr.concat(this));
    }
  };
  function freezeDraftable(val) {
    return isDraftable(val) ? produce(val, () => {
    }) : val;
  }
  function getOrInsertComputed(map, key, compute) {
    if (map.has(key)) return map.get(key);
    return map.set(key, compute(key)).get(key);
  }
  function isBoolean2(x) {
    return typeof x === "boolean";
  }
  var buildGetDefaultMiddleware = () => function getDefaultMiddleware(options) {
    const {
      thunk: thunk2 = true,
      immutableCheck = true,
      serializableCheck = true,
      actionCreatorCheck = true
    } = options ?? {};
    let middlewareArray = new Tuple();
    if (thunk2) {
      if (isBoolean2(thunk2)) {
        middlewareArray.push(thunk);
      } else {
        middlewareArray.push(withExtraArgument(thunk2.extraArgument));
      }
    }
    if (false) {
      if (immutableCheck) {
        let immutableOptions = {};
        if (!isBoolean2(immutableCheck)) {
          immutableOptions = immutableCheck;
        }
        middlewareArray.unshift(createImmutableStateInvariantMiddleware(immutableOptions));
      }
      if (serializableCheck) {
        let serializableOptions = {};
        if (!isBoolean2(serializableCheck)) {
          serializableOptions = serializableCheck;
        }
        middlewareArray.push(createSerializableStateInvariantMiddleware(serializableOptions));
      }
      if (actionCreatorCheck) {
        let actionCreatorOptions = {};
        if (!isBoolean2(actionCreatorCheck)) {
          actionCreatorOptions = actionCreatorCheck;
        }
        middlewareArray.unshift(createActionCreatorInvariantMiddleware(actionCreatorOptions));
      }
    }
    return middlewareArray;
  };
  var SHOULD_AUTOBATCH = "RTK_autoBatch";
  var createQueueWithTimer = (timeout) => {
    return (notify) => {
      setTimeout(notify, timeout);
    };
  };
  var createRafWithFallbackTimer = (raf, timeout) => {
    return (notify) => {
      let called = false;
      const callback = () => {
        if (called) return;
        called = true;
        cancelAnimationFrame(rafId);
        clearTimeout(timerId);
        notify();
      };
      const rafId = raf(callback);
      const timerId = setTimeout(callback, timeout);
    };
  };
  var autoBatchEnhancer = (options = {
    type: "raf"
  }) => (next) => (...args) => {
    const store = next(...args);
    let notifying = true;
    let shouldNotifyAtEndOfTick = false;
    let notificationQueued = false;
    const listeners = /* @__PURE__ */ new Set();
    const queueCallback = options.type === "tick" ? queueMicrotask : options.type === "raf" ? (
      // requestAnimationFrame won't exist in SSR environments. Fall back to a vague approximation just to keep from erroring.
      typeof window !== "undefined" && window.requestAnimationFrame ? createRafWithFallbackTimer(window.requestAnimationFrame, 100) : createQueueWithTimer(10)
    ) : options.type === "callback" ? options.queueNotification : createQueueWithTimer(options.timeout);
    const notifyListeners = () => {
      notificationQueued = false;
      if (shouldNotifyAtEndOfTick) {
        shouldNotifyAtEndOfTick = false;
        listeners.forEach((l) => l());
      }
    };
    return Object.assign({}, store, {
      // Override the base `store.subscribe` method to keep original listeners
      // from running if we're delaying notifications
      subscribe(listener2) {
        const wrappedListener = () => notifying && listener2();
        const unsubscribe = store.subscribe(wrappedListener);
        listeners.add(listener2);
        return () => {
          unsubscribe();
          listeners.delete(listener2);
        };
      },
      // Override the base `store.dispatch` method so that we can check actions
      // for the `shouldAutoBatch` flag and determine if batching is active
      dispatch(action) {
        try {
          notifying = !action?.meta?.[SHOULD_AUTOBATCH];
          shouldNotifyAtEndOfTick = !notifying;
          if (shouldNotifyAtEndOfTick) {
            if (!notificationQueued) {
              notificationQueued = true;
              queueCallback(notifyListeners);
            }
          }
          return store.dispatch(action);
        } finally {
          notifying = true;
        }
      }
    });
  };
  var buildGetDefaultEnhancers = (middlewareEnhancer) => function getDefaultEnhancers(options) {
    const {
      autoBatch = true
    } = options ?? {};
    let enhancerArray = new Tuple(middlewareEnhancer);
    if (autoBatch) {
      enhancerArray.push(autoBatchEnhancer(typeof autoBatch === "object" ? autoBatch : void 0));
    }
    return enhancerArray;
  };
  function configureStore(options) {
    const getDefaultMiddleware = buildGetDefaultMiddleware();
    const {
      reducer = void 0,
      middleware,
      devTools = true,
      duplicateMiddlewareCheck = true,
      preloadedState = void 0,
      enhancers = void 0
    } = options || {};
    let rootReducer2;
    if (typeof reducer === "function") {
      rootReducer2 = reducer;
    } else if (isPlainObject2(reducer)) {
      rootReducer2 = combineReducers(reducer);
    } else {
      throw new Error(true ? formatProdErrorMessage2(1) : "`reducer` is a required argument, and must be a function or an object of functions that can be passed to combineReducers");
    }
    if (false) {
      throw new Error(true ? formatProdErrorMessage2(2) : "`middleware` field must be a callback");
    }
    let finalMiddleware;
    if (typeof middleware === "function") {
      finalMiddleware = middleware(getDefaultMiddleware);
      if (false) {
        throw new Error(true ? formatProdErrorMessage2(3) : "when using a middleware builder function, an array of middleware must be returned");
      }
    } else {
      finalMiddleware = getDefaultMiddleware();
    }
    if (false) {
      throw new Error(true ? formatProdErrorMessage2(4) : "each middleware provided to configureStore must be a function");
    }
    if (false) {
      let middlewareReferences = /* @__PURE__ */ new Set();
      finalMiddleware.forEach((middleware2) => {
        if (middlewareReferences.has(middleware2)) {
          throw new Error(true ? formatProdErrorMessage2(42) : "Duplicate middleware references found when creating the store. Ensure that each middleware is only included once.");
        }
        middlewareReferences.add(middleware2);
      });
    }
    let finalCompose = compose;
    if (devTools) {
      finalCompose = composeWithDevTools({
        // Enable capture of stack traces for dispatched Redux actions
        trace: false,
        ...typeof devTools === "object" && devTools
      });
    }
    const middlewareEnhancer = applyMiddleware(...finalMiddleware);
    const getDefaultEnhancers = buildGetDefaultEnhancers(middlewareEnhancer);
    if (false) {
      throw new Error(true ? formatProdErrorMessage2(5) : "`enhancers` field must be a callback");
    }
    let storeEnhancers = typeof enhancers === "function" ? enhancers(getDefaultEnhancers) : getDefaultEnhancers();
    if (false) {
      throw new Error(true ? formatProdErrorMessage2(6) : "`enhancers` callback must return an array");
    }
    if (false) {
      throw new Error(true ? formatProdErrorMessage2(7) : "each enhancer provided to configureStore must be a function");
    }
    if (false) {
      console.error("middlewares were provided, but middleware enhancer was not included in final enhancers - make sure to call `getDefaultEnhancers`");
    }
    const composedEnhancer = finalCompose(...storeEnhancers);
    return createStore(rootReducer2, preloadedState, composedEnhancer);
  }
  function executeReducerBuilderCallback(builderCallback) {
    const actionsMap = {};
    const actionMatchers = [];
    let defaultCaseReducer;
    const builder = {
      addCase(typeOrActionCreator, reducer) {
        if (false) {
          if (actionMatchers.length > 0) {
            throw new Error(true ? formatProdErrorMessage2(26) : "`builder.addCase` should only be called before calling `builder.addMatcher`");
          }
          if (defaultCaseReducer) {
            throw new Error(true ? formatProdErrorMessage2(27) : "`builder.addCase` should only be called before calling `builder.addDefaultCase`");
          }
        }
        const type = typeof typeOrActionCreator === "string" ? typeOrActionCreator : typeOrActionCreator.type;
        if (!type) {
          throw new Error(true ? formatProdErrorMessage2(28) : "`builder.addCase` cannot be called with an empty action type");
        }
        if (type in actionsMap) {
          throw new Error(true ? formatProdErrorMessage2(29) : `\`builder.addCase\` cannot be called with two reducers for the same action type '${type}'`);
        }
        actionsMap[type] = reducer;
        return builder;
      },
      addAsyncThunk(asyncThunk, reducers) {
        if (false) {
          if (defaultCaseReducer) {
            throw new Error(true ? formatProdErrorMessage2(43) : "`builder.addAsyncThunk` should only be called before calling `builder.addDefaultCase`");
          }
        }
        if (reducers.pending) actionsMap[asyncThunk.pending.type] = reducers.pending;
        if (reducers.rejected) actionsMap[asyncThunk.rejected.type] = reducers.rejected;
        if (reducers.fulfilled) actionsMap[asyncThunk.fulfilled.type] = reducers.fulfilled;
        if (reducers.settled) actionMatchers.push({
          matcher: asyncThunk.settled,
          reducer: reducers.settled
        });
        return builder;
      },
      addMatcher(matcher, reducer) {
        if (false) {
          if (defaultCaseReducer) {
            throw new Error(true ? formatProdErrorMessage2(30) : "`builder.addMatcher` should only be called before calling `builder.addDefaultCase`");
          }
        }
        actionMatchers.push({
          matcher,
          reducer
        });
        return builder;
      },
      addDefaultCase(reducer) {
        if (false) {
          if (defaultCaseReducer) {
            throw new Error(true ? formatProdErrorMessage2(31) : "`builder.addDefaultCase` can only be called once");
          }
        }
        defaultCaseReducer = reducer;
        return builder;
      }
    };
    builderCallback(builder);
    return [actionsMap, actionMatchers, defaultCaseReducer];
  }
  function isStateFunction(x) {
    return typeof x === "function";
  }
  function createReducer(initialState, mapOrBuilderCallback) {
    if (false) {
      if (typeof mapOrBuilderCallback === "object") {
        throw new Error(true ? formatProdErrorMessage2(8) : "The object notation for `createReducer` has been removed. Please use the 'builder callback' notation instead: https://redux-toolkit.js.org/api/createReducer");
      }
    }
    let [actionsMap, finalActionMatchers, finalDefaultCaseReducer] = executeReducerBuilderCallback(mapOrBuilderCallback);
    let getInitialState;
    if (isStateFunction(initialState)) {
      getInitialState = () => freezeDraftable(initialState());
    } else {
      const frozenInitialState = freezeDraftable(initialState);
      getInitialState = () => frozenInitialState;
    }
    function reducer(state = getInitialState(), action) {
      let caseReducers = [actionsMap[action.type], ...finalActionMatchers.filter(({
        matcher
      }) => matcher(action)).map(({
        reducer: reducer2
      }) => reducer2)];
      if (caseReducers.filter((cr) => !!cr).length === 0) {
        caseReducers = [finalDefaultCaseReducer];
      }
      return caseReducers.reduce((previousState, caseReducer) => {
        if (caseReducer) {
          if (isDraft(previousState)) {
            const draft = previousState;
            const result = caseReducer(draft, action);
            if (result === void 0) {
              return previousState;
            }
            return result;
          } else if (!isDraftable(previousState)) {
            const result = caseReducer(previousState, action);
            if (result === void 0) {
              if (previousState === null) {
                return previousState;
              }
              throw Error("A case reducer on a non-draftable value must not return undefined");
            }
            return result;
          } else {
            return produce(previousState, (draft) => {
              return caseReducer(draft, action);
            });
          }
        }
        return previousState;
      }, state);
    }
    reducer.getInitialState = getInitialState;
    return reducer;
  }
  var matches = (matcher, action) => {
    if (hasMatchFunction(matcher)) {
      return matcher.match(action);
    } else {
      return matcher(action);
    }
  };
  function isAnyOf(...matchers) {
    return (action) => {
      return matchers.some((matcher) => matches(matcher, action));
    };
  }
  var urlAlphabet = "ModuleSymbhasOwnPr-0123456789ABCDEFGHNRVfgctiUvz_KqYTJkLxpZXIjQW";
  var nanoid = (size = 21) => {
    let id = "";
    let i = size;
    while (i--) {
      id += urlAlphabet[Math.random() * 64 | 0];
    }
    return id;
  };
  var commonProperties = ["name", "message", "stack", "code"];
  var RejectWithValue = class {
    constructor(payload, meta) {
      this.payload = payload;
      this.meta = meta;
    }
    payload;
    meta;
    /*
    type-only property to distinguish between RejectWithValue and FulfillWithMeta
    does not exist at runtime
    */
    _type;
  };
  var FulfillWithMeta = class {
    constructor(payload, meta) {
      this.payload = payload;
      this.meta = meta;
    }
    payload;
    meta;
    /*
    type-only property to distinguish between RejectWithValue and FulfillWithMeta
    does not exist at runtime
    */
    _type;
  };
  var miniSerializeError = (value) => {
    if (typeof value === "object" && value !== null) {
      const simpleError = {};
      for (const property of commonProperties) {
        if (typeof value[property] === "string") {
          simpleError[property] = value[property];
        }
      }
      return simpleError;
    }
    return {
      message: String(value)
    };
  };
  var externalAbortMessage = "External signal was aborted";
  var createAsyncThunk = /* @__PURE__ */ (() => {
    function createAsyncThunk2(typePrefix, payloadCreator, options) {
      const fulfilled = createAction(typePrefix + "/fulfilled", (payload, requestId, arg, meta) => ({
        payload,
        meta: {
          ...meta || {},
          arg,
          requestId,
          requestStatus: "fulfilled"
        }
      }));
      const pending = createAction(typePrefix + "/pending", (requestId, arg, meta) => ({
        payload: void 0,
        meta: {
          ...meta || {},
          arg,
          requestId,
          requestStatus: "pending"
        }
      }));
      const rejected = createAction(typePrefix + "/rejected", (error, requestId, arg, payload, meta) => ({
        payload,
        error: (options && options.serializeError || miniSerializeError)(error || "Rejected"),
        meta: {
          ...meta || {},
          arg,
          requestId,
          rejectedWithValue: !!payload,
          requestStatus: "rejected",
          aborted: error?.name === "AbortError",
          condition: error?.name === "ConditionError"
        }
      }));
      function actionCreator(arg, {
        signal
      } = {}) {
        return (dispatch, getState, extra) => {
          const requestId = options?.idGenerator ? options.idGenerator(arg) : nanoid();
          const abortController = new AbortController();
          let abortHandler;
          let abortReason;
          function abort(reason) {
            abortReason = reason;
            abortController.abort();
          }
          if (signal) {
            if (signal.aborted) {
              abort(externalAbortMessage);
            } else {
              signal.addEventListener("abort", () => abort(externalAbortMessage), {
                once: true
              });
            }
          }
          const promise = (async function() {
            let finalAction;
            try {
              let conditionResult = options?.condition?.(arg, {
                getState,
                extra
              });
              if (isThenable(conditionResult)) {
                conditionResult = await conditionResult;
              }
              if (conditionResult === false || abortController.signal.aborted) {
                throw {
                  name: "ConditionError",
                  message: "Aborted due to condition callback returning false."
                };
              }
              const abortedPromise = new Promise((_, reject) => {
                abortHandler = () => {
                  reject({
                    name: "AbortError",
                    message: abortReason || "Aborted"
                  });
                };
                abortController.signal.addEventListener("abort", abortHandler, {
                  once: true
                });
              });
              dispatch(pending(requestId, arg, options?.getPendingMeta?.({
                requestId,
                arg
              }, {
                getState,
                extra
              })));
              finalAction = await Promise.race([abortedPromise, Promise.resolve(payloadCreator(arg, {
                dispatch,
                getState,
                extra,
                requestId,
                signal: abortController.signal,
                abort,
                rejectWithValue: ((value, meta) => {
                  return new RejectWithValue(value, meta);
                }),
                fulfillWithValue: ((value, meta) => {
                  return new FulfillWithMeta(value, meta);
                })
              })).then((result) => {
                if (result instanceof RejectWithValue) {
                  throw result;
                }
                if (result instanceof FulfillWithMeta) {
                  return fulfilled(result.payload, requestId, arg, result.meta);
                }
                return fulfilled(result, requestId, arg);
              })]);
            } catch (err) {
              finalAction = err instanceof RejectWithValue ? rejected(null, requestId, arg, err.payload, err.meta) : rejected(err, requestId, arg);
            } finally {
              if (abortHandler) {
                abortController.signal.removeEventListener("abort", abortHandler);
              }
            }
            const skipDispatch = options && !options.dispatchConditionRejection && rejected.match(finalAction) && finalAction.meta.condition;
            if (!skipDispatch) {
              dispatch(finalAction);
            }
            return finalAction;
          })();
          return Object.assign(promise, {
            abort,
            requestId,
            arg,
            unwrap() {
              return promise.then(unwrapResult);
            }
          });
        };
      }
      return Object.assign(actionCreator, {
        pending,
        rejected,
        fulfilled,
        settled: isAnyOf(rejected, fulfilled),
        typePrefix
      });
    }
    createAsyncThunk2.withTypes = () => createAsyncThunk2;
    return createAsyncThunk2;
  })();
  function unwrapResult(action) {
    if (action.meta && action.meta.rejectedWithValue) {
      throw action.payload;
    }
    if (action.error) {
      throw action.error;
    }
    return action.payload;
  }
  function isThenable(value) {
    return value !== null && typeof value === "object" && typeof value.then === "function";
  }
  var asyncThunkSymbol = /* @__PURE__ */ Symbol.for("rtk-slice-createasyncthunk");
  var asyncThunkCreator = {
    [asyncThunkSymbol]: createAsyncThunk
  };
  function getType(slice, actionKey) {
    return `${slice}/${actionKey}`;
  }
  function buildCreateSlice({
    creators
  } = {}) {
    const cAT = creators?.asyncThunk?.[asyncThunkSymbol];
    return function createSlice2(options) {
      const {
        name,
        reducerPath = name
      } = options;
      if (!name) {
        throw new Error(true ? formatProdErrorMessage2(11) : "`name` is a required option for createSlice");
      }
      if (typeof process !== "undefined" && false) {
        if (options.initialState === void 0) {
          console.error("You must provide an `initialState` value that is not `undefined`. You may have misspelled `initialState`");
        }
      }
      const reducers = (typeof options.reducers === "function" ? options.reducers(buildReducerCreators()) : options.reducers) || {};
      const reducerNames = Object.keys(reducers);
      const context = {
        sliceCaseReducersByName: {},
        sliceCaseReducersByType: {},
        actionCreators: {},
        sliceMatchers: []
      };
      const contextMethods = {
        addCase(typeOrActionCreator, reducer2) {
          const type = typeof typeOrActionCreator === "string" ? typeOrActionCreator : typeOrActionCreator.type;
          if (!type) {
            throw new Error(true ? formatProdErrorMessage2(12) : "`context.addCase` cannot be called with an empty action type");
          }
          if (type in context.sliceCaseReducersByType) {
            throw new Error(true ? formatProdErrorMessage2(13) : "`context.addCase` cannot be called with two reducers for the same action type: " + type);
          }
          context.sliceCaseReducersByType[type] = reducer2;
          return contextMethods;
        },
        addMatcher(matcher, reducer2) {
          context.sliceMatchers.push({
            matcher,
            reducer: reducer2
          });
          return contextMethods;
        },
        exposeAction(name2, actionCreator) {
          context.actionCreators[name2] = actionCreator;
          return contextMethods;
        },
        exposeCaseReducer(name2, reducer2) {
          context.sliceCaseReducersByName[name2] = reducer2;
          return contextMethods;
        }
      };
      reducerNames.forEach((reducerName) => {
        const reducerDefinition = reducers[reducerName];
        const reducerDetails = {
          reducerName,
          type: getType(name, reducerName),
          createNotation: typeof options.reducers === "function"
        };
        if (isAsyncThunkSliceReducerDefinition(reducerDefinition)) {
          handleThunkCaseReducerDefinition(reducerDetails, reducerDefinition, contextMethods, cAT);
        } else {
          handleNormalReducerDefinition(reducerDetails, reducerDefinition, contextMethods);
        }
      });
      function buildReducer() {
        if (false) {
          if (typeof options.extraReducers === "object") {
            throw new Error(true ? formatProdErrorMessage2(14) : "The object notation for `createSlice.extraReducers` has been removed. Please use the 'builder callback' notation instead: https://redux-toolkit.js.org/api/createSlice");
          }
        }
        const [extraReducers = {}, actionMatchers = [], defaultCaseReducer = void 0] = typeof options.extraReducers === "function" ? executeReducerBuilderCallback(options.extraReducers) : [options.extraReducers];
        const finalCaseReducers = {
          ...extraReducers,
          ...context.sliceCaseReducersByType
        };
        return createReducer(options.initialState, (builder) => {
          for (let key in finalCaseReducers) {
            builder.addCase(key, finalCaseReducers[key]);
          }
          for (let sM of context.sliceMatchers) {
            builder.addMatcher(sM.matcher, sM.reducer);
          }
          for (let m of actionMatchers) {
            builder.addMatcher(m.matcher, m.reducer);
          }
          if (defaultCaseReducer) {
            builder.addDefaultCase(defaultCaseReducer);
          }
        });
      }
      const selectSelf = (state) => state;
      const injectedSelectorCache = /* @__PURE__ */ new Map();
      const injectedStateCache = /* @__PURE__ */ new WeakMap();
      let _reducer;
      function reducer(state, action) {
        if (!_reducer) _reducer = buildReducer();
        return _reducer(state, action);
      }
      function getInitialState() {
        if (!_reducer) _reducer = buildReducer();
        return _reducer.getInitialState();
      }
      function makeSelectorProps(reducerPath2, injected = false) {
        function selectSlice(state) {
          let sliceState = state[reducerPath2];
          if (typeof sliceState === "undefined") {
            if (injected) {
              sliceState = getOrInsertComputed(injectedStateCache, selectSlice, getInitialState);
            } else if (false) {
              throw new Error(true ? formatProdErrorMessage2(15) : "selectSlice returned undefined for an uninjected slice reducer");
            }
          }
          return sliceState;
        }
        function getSelectors(selectState = selectSelf) {
          const selectorCache = getOrInsertComputed(injectedSelectorCache, injected, () => /* @__PURE__ */ new WeakMap());
          return getOrInsertComputed(selectorCache, selectState, () => {
            const map = {};
            for (const [name2, selector] of Object.entries(options.selectors ?? {})) {
              map[name2] = wrapSelector(selector, selectState, () => getOrInsertComputed(injectedStateCache, selectState, getInitialState), injected);
            }
            return map;
          });
        }
        return {
          reducerPath: reducerPath2,
          getSelectors,
          get selectors() {
            return getSelectors(selectSlice);
          },
          selectSlice
        };
      }
      const slice = {
        name,
        reducer,
        actions: context.actionCreators,
        caseReducers: context.sliceCaseReducersByName,
        getInitialState,
        ...makeSelectorProps(reducerPath),
        injectInto(injectable, {
          reducerPath: pathOpt,
          ...config
        } = {}) {
          const newReducerPath = pathOpt ?? reducerPath;
          injectable.inject({
            reducerPath: newReducerPath,
            reducer
          }, config);
          return {
            ...slice,
            ...makeSelectorProps(newReducerPath, true)
          };
        }
      };
      return slice;
    };
  }
  function wrapSelector(selector, selectState, getInitialState, injected) {
    function wrapper(rootState, ...args) {
      let sliceState = selectState(rootState);
      if (typeof sliceState === "undefined") {
        if (injected) {
          sliceState = getInitialState();
        } else if (false) {
          throw new Error(true ? formatProdErrorMessage2(16) : "selectState returned undefined for an uninjected slice reducer");
        }
      }
      return selector(sliceState, ...args);
    }
    wrapper.unwrapped = selector;
    return wrapper;
  }
  var createSlice = /* @__PURE__ */ buildCreateSlice();
  function buildReducerCreators() {
    function asyncThunk(payloadCreator, config) {
      return {
        _reducerDefinitionType: "asyncThunk",
        payloadCreator,
        ...config
      };
    }
    asyncThunk.withTypes = () => asyncThunk;
    return {
      reducer(caseReducer) {
        return Object.assign({
          // hack so the wrapping function has the same name as the original
          // we need to create a wrapper so the `reducerDefinitionType` is not assigned to the original
          [caseReducer.name](...args) {
            return caseReducer(...args);
          }
        }[caseReducer.name], {
          _reducerDefinitionType: "reducer"
          /* reducer */
        });
      },
      preparedReducer(prepare, reducer) {
        return {
          _reducerDefinitionType: "reducerWithPrepare",
          prepare,
          reducer
        };
      },
      asyncThunk
    };
  }
  function handleNormalReducerDefinition({
    type,
    reducerName,
    createNotation
  }, maybeReducerWithPrepare, context) {
    let caseReducer;
    let prepareCallback;
    if ("reducer" in maybeReducerWithPrepare) {
      if (createNotation && !isCaseReducerWithPrepareDefinition(maybeReducerWithPrepare)) {
        throw new Error(true ? formatProdErrorMessage2(17) : "Please use the `create.preparedReducer` notation for prepared action creators with the `create` notation.");
      }
      caseReducer = maybeReducerWithPrepare.reducer;
      prepareCallback = maybeReducerWithPrepare.prepare;
    } else {
      caseReducer = maybeReducerWithPrepare;
    }
    context.addCase(type, caseReducer).exposeCaseReducer(reducerName, caseReducer).exposeAction(reducerName, prepareCallback ? createAction(type, prepareCallback) : createAction(type));
  }
  function isAsyncThunkSliceReducerDefinition(reducerDefinition) {
    return reducerDefinition._reducerDefinitionType === "asyncThunk";
  }
  function isCaseReducerWithPrepareDefinition(reducerDefinition) {
    return reducerDefinition._reducerDefinitionType === "reducerWithPrepare";
  }
  function handleThunkCaseReducerDefinition({
    type,
    reducerName
  }, reducerDefinition, context, cAT) {
    if (!cAT) {
      throw new Error(true ? formatProdErrorMessage2(18) : "Cannot use `create.asyncThunk` in the built-in `createSlice`. Use `buildCreateSlice({ creators: { asyncThunk: asyncThunkCreator } })` to create a customised version of `createSlice`.");
    }
    const {
      payloadCreator,
      fulfilled,
      pending,
      rejected,
      settled,
      options
    } = reducerDefinition;
    const thunk2 = cAT(type, payloadCreator, options);
    context.exposeAction(reducerName, thunk2);
    if (fulfilled) {
      context.addCase(thunk2.fulfilled, fulfilled);
    }
    if (pending) {
      context.addCase(thunk2.pending, pending);
    }
    if (rejected) {
      context.addCase(thunk2.rejected, rejected);
    }
    if (settled) {
      context.addMatcher(thunk2.settled, settled);
    }
    context.exposeCaseReducer(reducerName, {
      fulfilled: fulfilled || noop,
      pending: pending || noop,
      rejected: rejected || noop,
      settled: settled || noop
    });
  }
  function noop() {
  }
  var listener = "listener";
  var completed = "completed";
  var cancelled = "cancelled";
  var taskCancelled = `task-${cancelled}`;
  var taskCompleted = `task-${completed}`;
  var listenerCancelled = `${listener}-${cancelled}`;
  var listenerCompleted = `${listener}-${completed}`;
  var {
    assign
  } = Object;
  var alm = "listenerMiddleware";
  var addListener = /* @__PURE__ */ assign(/* @__PURE__ */ createAction(`${alm}/add`), {
    withTypes: () => addListener
  });
  var clearAllListeners = /* @__PURE__ */ createAction(`${alm}/removeAll`);
  var removeListener = /* @__PURE__ */ assign(/* @__PURE__ */ createAction(`${alm}/remove`), {
    withTypes: () => removeListener
  });
  var isSliceLike = (maybeSliceLike) => "reducerPath" in maybeSliceLike && typeof maybeSliceLike.reducerPath === "string";
  var getReducers = (slices) => slices.flatMap((sliceOrMap) => isSliceLike(sliceOrMap) ? [[sliceOrMap.reducerPath, sliceOrMap.reducer]] : Object.entries(sliceOrMap));
  var ORIGINAL_STATE = /* @__PURE__ */ Symbol.for("rtk-state-proxy-original");
  var isStateProxy = (value) => !!value && !!value[ORIGINAL_STATE];
  var stateProxyMap = /* @__PURE__ */ new WeakMap();
  var createStateProxy = (state, reducerMap, initialStateCache) => getOrInsertComputed(stateProxyMap, state, () => new Proxy(state, {
    get: (target, prop, receiver) => {
      if (prop === ORIGINAL_STATE) return target;
      const result = Reflect.get(target, prop, receiver);
      if (typeof result === "undefined") {
        const cached = initialStateCache[prop];
        if (typeof cached !== "undefined") return cached;
        const reducer = reducerMap[prop];
        if (reducer) {
          const reducerResult = reducer(void 0, {
            type: nanoid()
          });
          if (typeof reducerResult === "undefined") {
            throw new Error(true ? formatProdErrorMessage2(24) : `The slice reducer for key "${prop.toString()}" returned undefined when called for selector(). If the state passed to the reducer is undefined, you must explicitly return the initial state. The initial state may not be undefined. If you don't want to set a value for this reducer, you can use null instead of undefined.`);
          }
          initialStateCache[prop] = reducerResult;
          return reducerResult;
        }
      }
      return result;
    }
  }));
  var original = (state) => {
    if (!isStateProxy(state)) {
      throw new Error(true ? formatProdErrorMessage2(25) : "original must be used on state Proxy");
    }
    return state[ORIGINAL_STATE];
  };
  var emptyObject = {};
  var noopReducer = (state = emptyObject) => state;
  function combineSlices(...slices) {
    const reducerMap = Object.fromEntries(getReducers(slices));
    const getReducer = () => Object.keys(reducerMap).length ? combineReducers(reducerMap) : noopReducer;
    let reducer = getReducer();
    function combinedReducer(state, action) {
      return reducer(state, action);
    }
    combinedReducer.withLazyLoadedSlices = () => combinedReducer;
    const initialStateCache = {};
    const inject = (slice, config = {}) => {
      const {
        reducerPath,
        reducer: reducerToInject
      } = slice;
      const currentReducer = reducerMap[reducerPath];
      if (!config.overrideExisting && currentReducer && currentReducer !== reducerToInject) {
        if (typeof process !== "undefined" && false) {
          console.error(`called \`inject\` to override already-existing reducer ${reducerPath} without specifying \`overrideExisting: true\``);
        }
        return combinedReducer;
      }
      if (config.overrideExisting && currentReducer !== reducerToInject) {
        delete initialStateCache[reducerPath];
      }
      reducerMap[reducerPath] = reducerToInject;
      reducer = getReducer();
      return combinedReducer;
    };
    const selector = Object.assign(function makeSelector(selectorFn, selectState) {
      return function selector2(state, ...args) {
        return selectorFn(createStateProxy(selectState ? selectState(state, ...args) : state, reducerMap, initialStateCache), ...args);
      };
    }, {
      original
    });
    return Object.assign(combinedReducer, {
      inject,
      selector
    });
  }
  function formatProdErrorMessage2(code) {
    return `Minified Redux Toolkit error #${code}; visit https://redux-toolkit.js.org/Errors?code=${code} for the full message or use the non-minified dev environment for full errors. `;
  }

  // node_modules/react-redux/dist/react-redux.mjs
  init_react_global_shim();
  var import_with_selector = __toESM(require_with_selector(), 1);
  var REACT_FORWARD_REF_TYPE = /* @__PURE__ */ Symbol.for("react.forward_ref");
  var REACT_MEMO_TYPE = /* @__PURE__ */ Symbol.for("react.memo");
  var ForwardRef = REACT_FORWARD_REF_TYPE;
  var Memo = REACT_MEMO_TYPE;
  function defaultNoopBatch(callback) {
    callback();
  }
  function createListenerCollection() {
    let first = null;
    let last = null;
    return {
      clear() {
        first = null;
        last = null;
      },
      notify() {
        defaultNoopBatch(() => {
          let listener2 = first;
          while (listener2) {
            listener2.callback();
            listener2 = listener2.next;
          }
        });
      },
      get() {
        const listeners = [];
        let listener2 = first;
        while (listener2) {
          listeners.push(listener2);
          listener2 = listener2.next;
        }
        return listeners;
      },
      subscribe(callback) {
        let isSubscribed = true;
        const listener2 = last = {
          callback,
          next: null,
          prev: last
        };
        if (listener2.prev) {
          listener2.prev.next = listener2;
        } else {
          first = listener2;
        }
        return function unsubscribe() {
          if (!isSubscribed || first === null) return;
          isSubscribed = false;
          if (listener2.next) {
            listener2.next.prev = listener2.prev;
          } else {
            last = listener2.prev;
          }
          if (listener2.prev) {
            listener2.prev.next = listener2.next;
          } else {
            first = listener2.next;
          }
        };
      }
    };
  }
  var nullListeners = {
    notify() {
    },
    get: () => []
  };
  function createSubscription(store, parentSub) {
    let unsubscribe;
    let listeners = nullListeners;
    let subscriptionsAmount = 0;
    let selfSubscribed = false;
    function addNestedSub(listener2) {
      trySubscribe();
      const cleanupListener = listeners.subscribe(listener2);
      let removed = false;
      return () => {
        if (!removed) {
          removed = true;
          cleanupListener();
          tryUnsubscribe();
        }
      };
    }
    function notifyNestedSubs() {
      listeners.notify();
    }
    function handleChangeWrapper() {
      if (subscription.onStateChange) {
        subscription.onStateChange();
      }
    }
    function isSubscribed() {
      return selfSubscribed;
    }
    function trySubscribe() {
      subscriptionsAmount++;
      if (!unsubscribe) {
        unsubscribe = parentSub ? parentSub.addNestedSub(handleChangeWrapper) : store.subscribe(handleChangeWrapper);
        listeners = createListenerCollection();
      }
    }
    function tryUnsubscribe() {
      subscriptionsAmount--;
      if (unsubscribe && subscriptionsAmount === 0) {
        unsubscribe();
        unsubscribe = void 0;
        listeners.clear();
        listeners = nullListeners;
      }
    }
    function trySubscribeSelf() {
      if (!selfSubscribed) {
        selfSubscribed = true;
        trySubscribe();
      }
    }
    function tryUnsubscribeSelf() {
      if (selfSubscribed) {
        selfSubscribed = false;
        tryUnsubscribe();
      }
    }
    const subscription = {
      addNestedSub,
      notifyNestedSubs,
      handleChangeWrapper,
      isSubscribed,
      trySubscribe: trySubscribeSelf,
      tryUnsubscribe: tryUnsubscribeSelf,
      getListeners: () => listeners
    };
    return subscription;
  }
  var canUseDOM = () => !!(typeof window !== "undefined" && typeof window.document !== "undefined" && typeof window.document.createElement !== "undefined");
  var isDOM = /* @__PURE__ */ canUseDOM();
  var isRunningInReactNative = () => typeof navigator !== "undefined" && navigator.product === "ReactNative";
  var isReactNative = /* @__PURE__ */ isRunningInReactNative();
  var getUseIsomorphicLayoutEffect = () => isDOM || isReactNative ? useLayoutEffect : useEffect;
  var useIsomorphicLayoutEffect = /* @__PURE__ */ getUseIsomorphicLayoutEffect();
  var FORWARD_REF_STATICS = {
    $$typeof: true,
    render: true,
    defaultProps: true,
    displayName: true,
    propTypes: true
  };
  var MEMO_STATICS = {
    $$typeof: true,
    compare: true,
    defaultProps: true,
    displayName: true,
    propTypes: true,
    type: true
  };
  var TYPE_STATICS = {
    [ForwardRef]: FORWARD_REF_STATICS,
    [Memo]: MEMO_STATICS
  };
  var objectPrototype = Object.prototype;
  var ContextKey = /* @__PURE__ */ Symbol.for(`react-redux-context`);
  var gT = typeof globalThis !== "undefined" ? globalThis : (
    /* fall back to a per-module scope (pre-8.1 behaviour) if `globalThis` is not available */
    {}
  );
  function getContext() {
    if (!createContext) return {};
    const contextMap = gT[ContextKey] ??= /* @__PURE__ */ new Map();
    let realContext = contextMap.get(createContext);
    if (!realContext) {
      realContext = createContext(
        null
      );
      if (false) {
        realContext.displayName = "ReactRedux";
      }
      contextMap.set(createContext, realContext);
    }
    return realContext;
  }
  var ReactReduxContext = /* @__PURE__ */ getContext();
  function Provider(providerProps) {
    const { children, context, serverState, store } = providerProps;
    const contextValue = useMemo(() => {
      const subscription = createSubscription(store);
      const baseContextValue = {
        store,
        subscription,
        getServerState: serverState ? () => serverState : void 0
      };
      if (true) {
        return baseContextValue;
      } else {
        const { identityFunctionCheck = "once", stabilityCheck = "once" } = providerProps;
        return /* @__PURE__ */ Object.assign(baseContextValue, {
          stabilityCheck,
          identityFunctionCheck
        });
      }
    }, [store, serverState]);
    const previousState = useMemo(() => store.getState(), [store]);
    useIsomorphicLayoutEffect(() => {
      const { subscription } = contextValue;
      subscription.onStateChange = subscription.notifyNestedSubs;
      subscription.trySubscribe();
      if (previousState !== store.getState()) {
        subscription.notifyNestedSubs();
      }
      return () => {
        subscription.tryUnsubscribe();
        subscription.onStateChange = void 0;
      };
    }, [contextValue, previousState]);
    const Context = context || ReactReduxContext;
    return /* @__PURE__ */ createElement(Context.Provider, { value: contextValue }, children);
  }
  var Provider_default = Provider;
  function createReduxContextHook(context = ReactReduxContext) {
    return function useReduxContext2() {
      const contextValue = useContext(context);
      if (false) {
        throw new Error(
          "could not find react-redux context value; please ensure the component is wrapped in a <Provider>"
        );
      }
      return contextValue;
    };
  }
  var useReduxContext = /* @__PURE__ */ createReduxContextHook();
  function createStoreHook(context = ReactReduxContext) {
    const useReduxContext2 = context === ReactReduxContext ? useReduxContext : (
      // @ts-ignore
      createReduxContextHook(context)
    );
    const useStore2 = () => {
      const { store } = useReduxContext2();
      return store;
    };
    Object.assign(useStore2, {
      withTypes: () => useStore2
    });
    return useStore2;
  }
  var useStore = /* @__PURE__ */ createStoreHook();
  function createDispatchHook(context = ReactReduxContext) {
    const useStore2 = context === ReactReduxContext ? useStore : createStoreHook(context);
    const useDispatch2 = () => {
      const store = useStore2();
      return store.dispatch;
    };
    Object.assign(useDispatch2, {
      withTypes: () => useDispatch2
    });
    return useDispatch2;
  }
  var refEquality = (a, b) => a === b;
  function createSelectorHook(context = ReactReduxContext) {
    const useReduxContext2 = context === ReactReduxContext ? useReduxContext : createReduxContextHook(context);
    const useSelector2 = (selector, equalityFnOrOptions = {}) => {
      const { equalityFn = refEquality } = typeof equalityFnOrOptions === "function" ? { equalityFn: equalityFnOrOptions } : equalityFnOrOptions;
      if (false) {
        if (!selector) {
          throw new Error(`You must pass a selector to useSelector`);
        }
        if (typeof selector !== "function") {
          throw new Error(`You must pass a function as a selector to useSelector`);
        }
        if (typeof equalityFn !== "function") {
          throw new Error(
            `You must pass a function as an equality function to useSelector`
          );
        }
      }
      const reduxContext = useReduxContext2();
      const { store, subscription, getServerState } = reduxContext;
      const firstRun = useRef(true);
      const wrappedSelector = useCallback(
        {
          [selector.name](state) {
            const selected = selector(state);
            if (false) {
              const { devModeChecks = {} } = typeof equalityFnOrOptions === "function" ? {} : equalityFnOrOptions;
              const { identityFunctionCheck, stabilityCheck } = reduxContext;
              const {
                identityFunctionCheck: finalIdentityFunctionCheck,
                stabilityCheck: finalStabilityCheck
              } = {
                stabilityCheck,
                identityFunctionCheck,
                ...devModeChecks
              };
              if (finalStabilityCheck === "always" || finalStabilityCheck === "once" && firstRun.current) {
                const toCompare = selector(state);
                if (!equalityFn(selected, toCompare)) {
                  let stack = void 0;
                  try {
                    throw new Error();
                  } catch (e) {
                    ;
                    ({ stack } = e);
                  }
                  console.warn(
                    "Selector " + (selector.name || "unknown") + " returned a different result when called with the same parameters. This can lead to unnecessary rerenders.\nSelectors that return a new reference (such as an object or an array) should be memoized: https://redux.js.org/usage/deriving-data-selectors#optimizing-selectors-with-memoization",
                    {
                      state,
                      selected,
                      selected2: toCompare,
                      stack
                    }
                  );
                }
              }
              if (finalIdentityFunctionCheck === "always" || finalIdentityFunctionCheck === "once" && firstRun.current) {
                if (selected === state) {
                  let stack = void 0;
                  try {
                    throw new Error();
                  } catch (e) {
                    ;
                    ({ stack } = e);
                  }
                  console.warn(
                    "Selector " + (selector.name || "unknown") + " returned the root state when called. This can lead to unnecessary rerenders.\nSelectors that return the entire state are almost certainly a mistake, as they will cause a rerender whenever *anything* in state changes.",
                    { stack }
                  );
                }
              }
              if (firstRun.current) firstRun.current = false;
            }
            return selected;
          }
        }[selector.name],
        [selector]
      );
      const selectedState = (0, import_with_selector.useSyncExternalStoreWithSelector)(
        subscription.addNestedSub,
        store.getState,
        getServerState || store.getState,
        wrappedSelector,
        equalityFn
      );
      useDebugValue(selectedState);
      return selectedState;
    };
    Object.assign(useSelector2, {
      withTypes: () => useSelector2
    });
    return useSelector2;
  }

  // node_modules/react-querybuilder/dist/defaults-g6J_xYY8.mjs
  var ActionElement = (props) => /* @__PURE__ */ createElement("button", {
    type: "button",
    "data-testid": props.testID,
    disabled: props.disabled && !props.disabledTranslation,
    className: props.className,
    title: props.disabledTranslation && props.disabled ? props.disabledTranslation.title : props.title,
    onClick: (e) => props.handleOnClick(e)
  }, props.disabledTranslation && props.disabled ? props.disabledTranslation.label : props.label);
  var DragHandle = forwardRef((props, dragRef) => /* @__PURE__ */ createElement("span", {
    "data-testid": props.testID,
    ref: dragRef,
    className: props.className,
    title: props.title
  }, props.label));
  var InlineCombinator = (allProps) => {
    const { component: CombinatorSelectorComponent, ...props } = allProps;
    const className = clsx(props.schema.suppressStandardClassnames || standardClassnames.betweenRules, props.schema.classNames.betweenRules);
    return /* @__PURE__ */ createElement("div", {
      className,
      "data-testid": TestID.inlineCombinator
    }, /* @__PURE__ */ createElement(CombinatorSelectorComponent, {
      ...props,
      testID: TestID.combinators
    }));
  };
  var dummyFieldData = {
    name: "",
    value: "",
    label: ""
  };
  var requiresThreshold = (mm) => [
    "atleast",
    "atmost",
    "exactly"
  ].includes(lc(mm) ?? "");
  var dummyPath = [];
  var MatchModeEditor = (props) => {
    const { match, options, title, className, disabled, testID, schema, thresholdPlaceholder, selectorComponent: SelectorComponent = props.schema.controls.valueSelector, numericEditorComponent: NumericEditorComponent = props.schema.controls.valueEditor } = props;
    const { thresholdNum, thresholdRule, thresholdSchema, handleChangeMode, handleChangeThreshold } = useMatchModeEditor(props);
    const thresholdFieldData = useMemo(() => thresholdPlaceholder ? {
      ...dummyFieldData,
      placeholder: thresholdPlaceholder
    } : dummyFieldData, [thresholdPlaceholder]);
    return /* @__PURE__ */ createElement(Fragment, null, /* @__PURE__ */ createElement(SelectorComponent, {
      schema,
      testID,
      className,
      title,
      handleOnChange: handleChangeMode,
      disabled,
      value: match.mode,
      options,
      multiple: false,
      listsAsArrays: false,
      path: dummyPath,
      level: 0
    }), requiresThreshold(match.mode) && /* @__PURE__ */ createElement(NumericEditorComponent, {
      skipHook: true,
      testID,
      inputType: "number",
      title,
      className,
      disabled,
      handleOnChange: handleChangeThreshold,
      field: "",
      operator: "",
      value: thresholdNum,
      valueSource: "value",
      fieldData: thresholdFieldData,
      schema: thresholdSchema,
      path: dummyPath,
      level: 0,
      rule: thresholdRule
    }));
  };
  var useMatchModeEditor = (props) => {
    const { match, handleOnChange } = props;
    const thresholdNum = useMemo(() => typeof match.threshold === "number" ? Math.max(0, match.threshold) : 1, [match.threshold]);
    return {
      thresholdNum,
      thresholdRule: useMemo(() => ({
        field: "",
        operator: "=",
        value: thresholdNum
      }), [thresholdNum]),
      thresholdSchema: useMemo(() => ({
        ...props.schema,
        parseNumbers: true
      }), [props.schema]),
      handleChangeMode: useCallback((mode) => {
        if (requiresThreshold(mode) && typeof match.threshold !== "number") handleOnChange({
          ...match,
          mode,
          threshold: 1
        });
        else handleOnChange({
          ...match,
          mode
        });
      }, [handleOnChange, match]),
      handleChangeThreshold: useCallback((threshold) => {
        handleOnChange({
          ...match,
          threshold: parseNumber(threshold, { parseNumbers: true })
        });
      }, [handleOnChange, match])
    };
  };
  var NotToggle = (props) => {
    const id = useId();
    return /* @__PURE__ */ createElement("label", {
      "data-testid": props.testID,
      className: props.className,
      title: props.title,
      htmlFor: id
    }, /* @__PURE__ */ createElement("input", {
      id,
      type: "checkbox",
      onChange: (e) => props.handleOnChange(e.target.checked),
      checked: !!props.checked,
      disabled: props.disabled
    }), props.label);
  };
  var messages = {
    errorInvalidIndependentCombinatorsProp: "QueryBuilder was rendered with a truthy independentCombinators prop. This prop is deprecated and unnecessary. Furthermore, the initial query/defaultQuery prop was of type RuleGroupType instead of type RuleGroupIC. More info: https://react-querybuilder.js.org/docs/components/querybuilder#independent-combinators",
    errorUnnecessaryIndependentCombinatorsProp: "QueryBuilder was rendered with the deprecated and unnecessary independentCombinators prop. To use independent combinators, make sure the query/defaultQuery prop is of type RuleGroupIC when the component mounts. More info: https://react-querybuilder.js.org/docs/components/querybuilder#independent-combinators",
    errorDeprecatedRuleGroupProps: "A custom RuleGroup component has rendered a standard RuleGroup component with deprecated props. The combinator, not, and rules props should not be used. Instead, the full group object should be passed as the ruleGroup prop.",
    errorDeprecatedRuleProps: "A custom RuleGroup component has rendered a standard Rule component with deprecated props. The field, operator, value, and valueSource props should not be used. Instead, the full rule object should be passed as the rule prop.",
    errorBothQueryDefaultQuery: "QueryBuilder was rendered with both query and defaultQuery props. QueryBuilder must be either controlled or uncontrolled (specify either the query prop, or the defaultQuery prop, but not both). Decide between using a controlled or uncontrolled query builder and remove one of these props. More info: https://reactjs.org/link/controlled-components",
    errorUncontrolledToControlled: "QueryBuilder is changing from an uncontrolled component to be controlled. This is likely caused by the query changing from undefined to a defined value, which should not happen. Decide between using a controlled or uncontrolled query builder for the lifetime of the component. More info: https://reactjs.org/link/controlled-components",
    errorControlledToUncontrolled: "QueryBuilder is changing from a controlled component to be uncontrolled. This is likely caused by the query changing from defined to undefined, which should not happen. Decide between using a controlled or uncontrolled query builder for the lifetime of the component. More info: https://reactjs.org/link/controlled-components",
    errorEnabledDndWithoutReactDnD: "QueryBuilder was rendered with the enableDragAndDrop prop set to true, but either react-dnd was not detected or one of react-dnd-html5-backend or react-dnd-touch-backend was not detected. To enable drag-and-drop functionality, install react-dnd and one of the backend packages and wrap QueryBuilder in QueryBuilderDnD from @react-querybuilder/dnd.",
    errorDeprecatedDebugImport: `Importing from react-querybuilder/debug is deprecated. To enable Redux DevTools for React Query Builder's internal store, set globalThis.__RQB_DEVTOOLS__ = true.`
  };
  var queriesSlice = createSlice({
    name: "queries",
    initialState: {},
    reducers: { setQueryState: (state, { payload: { qbId, query } }) => {
      state[qbId] = query;
    } },
    selectors: { getQuerySelectorById: (state, qbId) => state[qbId] }
  });
  var QueryBuilderStateContext = createContext(null);
  var warningsSlice = createSlice({
    name: "warnings",
    initialState: {
      [messages.errorInvalidIndependentCombinatorsProp]: false,
      [messages.errorUnnecessaryIndependentCombinatorsProp]: false,
      [messages.errorDeprecatedRuleGroupProps]: false,
      [messages.errorDeprecatedRuleProps]: false,
      [messages.errorBothQueryDefaultQuery]: false,
      [messages.errorUncontrolledToControlled]: false,
      [messages.errorControlledToUncontrolled]: false,
      [messages.errorEnabledDndWithoutReactDnD]: false,
      [messages.errorDeprecatedDebugImport]: false
    },
    reducers: { rqbWarn: (state, { payload }) => {
      if (!state[payload]) {
        console.error(payload);
        state[payload] = true;
      }
    } }
  });
  var rootReducer = combineSlices(queriesSlice, warningsSlice).withLazyLoadedSlices();
  var genUseQueryBuilderDispatch = (ctx) => createDispatchHook(ctx);
  var genUseQueryBuilderStore = (ctx) => createStoreHook(ctx);
  var genUseQueryBuilderSelector = (ctx) => createSelectorHook(ctx);
  var getInternalHooks = (ctx) => ({
    useRQB_INTERNAL_QueryBuilderDispatch: genUseQueryBuilderDispatch(ctx),
    useRQB_INTERNAL_QueryBuilderStore: genUseQueryBuilderStore(ctx),
    useRQB_INTERNAL_QueryBuilderSelector: genUseQueryBuilderSelector(ctx)
  });
  var _RQB_INTERNAL_dispatchThunk = ({ payload, onQueryChange }) => (dispatch) => {
    dispatch(queriesSlice.actions.setQueryState(payload));
    if (typeof onQueryChange === "function") onQueryChange(payload.query);
  };
  var internalHooks = getInternalHooks(QueryBuilderStateContext);
  var useRQB_INTERNAL_QueryBuilderDispatch = internalHooks.useRQB_INTERNAL_QueryBuilderDispatch;
  var useRQB_INTERNAL_QueryBuilderStore = internalHooks.useRQB_INTERNAL_QueryBuilderStore;
  var useRQB_INTERNAL_QueryBuilderSelector = internalHooks.useRQB_INTERNAL_QueryBuilderSelector;
  var { rqbWarn: _SYNC_rqbWarn } = warningsSlice.actions;
  var storeCommon = {
    reducer: rootReducer,
    preloadedState: {
      queries: queriesSlice.getInitialState(),
      warnings: warningsSlice.getInitialState()
    },
    middleware: (getDefaultMiddleware) => getDefaultMiddleware({ serializableCheck: {
      ignoredActions: [queriesSlice.actions.setQueryState.type],
      ignoredPaths: [/^queries\b.*\.rules\.\d+\.value$/]
    } })
  };
  var usePrevious = (value) => {
    const ref = useRef({
      value,
      prev: null
    });
    const current2 = ref.current.value;
    if (value !== current2) {
      ref.current.prev = current2;
      ref.current.value = value;
    }
    return ref.current.prev;
  };
  var useControlledOrUncontrolled = (params) => {
    const dispatch = useRQB_INTERNAL_QueryBuilderDispatch();
    const { defaultQuery, queryProp } = params;
    const prevQueryPresent = usePrevious(!!queryProp);
    if (false) {
      if (!!queryProp && !!defaultQuery) dispatch(rqbWarn(messages.errorBothQueryDefaultQuery));
      else if (prevQueryPresent === true && !queryProp && !!defaultQuery) dispatch(rqbWarn(messages.errorControlledToUncontrolled));
      else if (prevQueryPresent === false && !!queryProp && !defaultQuery) dispatch(rqbWarn(messages.errorUncontrolledToControlled));
    }
  };
  function useDeprecatedProps(type, logWarning, otherParams) {
    const dispatch = useRQB_INTERNAL_QueryBuilderDispatch();
    if (false) {
      if (type === "independentCombinators") {
        if (otherParams === "invalid") dispatch(rqbWarn(messages.errorInvalidIndependentCombinatorsProp));
        if (otherParams === "unnecessary") dispatch(rqbWarn(messages.errorUnnecessaryIndependentCombinatorsProp));
      }
      if (type === "rule") dispatch(rqbWarn(messages.errorDeprecatedRuleProps));
      if (type === "ruleGroup") dispatch(rqbWarn(messages.errorDeprecatedRuleGroupProps));
    }
  }
  var useFields = (props) => {
    const { optionList: fields, optionsMap: fieldMap, defaultOption: defaultField } = useMemo(() => prepareOptionList({
      placeholder: props.translations.fields,
      optionList: props.fields,
      autoSelectOption: props.autoSelectField,
      baseOption: props.baseField
    }), [
      props.autoSelectField,
      props.baseField,
      props.fields,
      props.translations.fields
    ]);
    return {
      fields,
      fieldMap,
      defaultField
    };
  };
  var configureRqbStore = (devTools) => {
    const queryBuilderStore2 = configureStore({
      ...storeCommon,
      devTools: devTools ? (
        /* v8 ignore next -- @preserve */
        { name: "React Query Builder" }
      ) : false
    });
    queryBuilderStore2.addSlice = (slice) => {
      rootReducer.inject(slice);
      queryBuilderStore2.dispatch({
        type: crypto.randomUUID().slice(0, 8),
        meta: `Initializing state for slice "${slice.name}"`
      });
    };
    return queryBuilderStore2;
  };
  var _store = null;
  function getRqbStore(devTools) {
    if (!_store) _store = configureRqbStore(devTools || globalThis?.__RQB_DEVTOOLS__);
    return _store;
  }
  var getQuerySelectorById = (qbId) => (state) => queriesSlice.selectors.getQuerySelectorById({ queries: state.queries }, qbId);
  var useQueryBuilderSelector = (selector, other) => {
    const rqbContext = useContext(QueryBuilderContext);
    return useRQB_INTERNAL_QueryBuilderSelector(selector, other) ?? rqbContext?.initialQuery;
  };
  var defaultValidationResult = {};
  var defaultValidationMap = {};
  var defaultDisabledPaths = [];
  var icCombinatorPropObject = {};
  var defaultGetValueEditorSeparator = () => null;
  var defaultGetRuleOrGroupClassname = () => "";
  var defaultOnAddMoveRemove = () => true;
  var defaultOnLog = (...params) => {
    console.log(...params);
  };
  function useQueryBuilderSchema(props, setup) {
    const { query: queryProp, defaultQuery: defaultQueryProp, getValueEditorSeparator = defaultGetValueEditorSeparator, getRuleClassname = defaultGetRuleOrGroupClassname, getRuleGroupClassname = defaultGetRuleOrGroupClassname, onAddRule = defaultOnAddMoveRemove, onAddGroup = defaultOnAddMoveRemove, onMoveRule = defaultOnAddMoveRemove, onMoveGroup = defaultOnAddMoveRemove, onGroupRule = defaultOnAddMoveRemove, onGroupGroup = defaultOnAddMoveRemove, onRemove = defaultOnAddMoveRemove, onQueryChange, showCombinatorsBetweenRules: showCombinatorsBetweenRulesProp = false, showNotToggle: showNotToggleProp = false, showShiftActions: showShiftActionsProp = false, showCloneButtons: showCloneButtonsProp = false, showLockButtons: showLockButtonsProp = false, showMuteButtons: showMuteButtonsProp = false, suppressStandardClassnames: suppressStandardClassnamesProp = false, resetOnFieldChange: resetOnFieldChangeProp = true, resetOnOperatorChange: resetOnOperatorChangeProp = false, autoSelectField: autoSelectFieldProp = true, autoSelectOperator: autoSelectOperatorProp = true, autoSelectValue: autoSelectValueProp = true, addRuleToNewGroups: addRuleToNewGroupsProp = false, listsAsArrays: listsAsArraysProp = false, parseNumbers = false, disabled = false, validator, onLog = defaultOnLog, idGenerator, accessibleDescriptionGenerator = generateAccessibleDescription } = props;
    const { qbId, rqbContext: incomingRqbContext, fields, fieldMap, combinators, getOperatorsMain, getMatchModesMain, getRuleDefaultOperator, getSubQueryBuilderPropsMain, getValueEditorTypeMain, getValueSourcesMain, getValuesMain, getRuleDefaultValue, getInputTypeMain, createRule, createRuleGroup } = setup;
    const { controlClassnames, controlElements: controls, debugMode, enableDragAndDrop, enableMountQueryChange, translations } = incomingRqbContext;
    const showCombinatorsBetweenRules = !!showCombinatorsBetweenRulesProp;
    const showNotToggle = !!showNotToggleProp;
    const showShiftActions = !!showShiftActionsProp;
    const showCloneButtons = !!showCloneButtonsProp;
    const showLockButtons = !!showLockButtonsProp;
    const showMuteButtons = !!showMuteButtonsProp;
    const resetOnFieldChange = !!resetOnFieldChangeProp;
    const resetOnOperatorChange = !!resetOnOperatorChangeProp;
    const autoSelectField = !!autoSelectFieldProp;
    const autoSelectOperator = !!autoSelectOperatorProp;
    const autoSelectValue = !!autoSelectValueProp;
    const addRuleToNewGroups = !!addRuleToNewGroupsProp;
    const listsAsArrays = !!listsAsArraysProp;
    const suppressStandardClassnames = !!suppressStandardClassnamesProp;
    const maxLevels = (props.maxLevels ?? 0) > 0 ? Number(props.maxLevels) : Infinity;
    const log = useCallback((...params) => {
      if (debugMode) onLog(...params);
    }, [debugMode, onLog]);
    useControlledOrUncontrolled({
      defaultQuery: defaultQueryProp,
      queryProp
    });
    const queryBuilderStore2 = useRQB_INTERNAL_QueryBuilderStore();
    const queryBuilderDispatch = useRQB_INTERNAL_QueryBuilderDispatch();
    const querySelector = useMemo(() => getQuerySelectorById(qbId), [qbId]);
    const storeQuery = useQueryBuilderSelector(querySelector);
    const getQuery = useCallback(() => querySelector(queryBuilderStore2.getState()), [queryBuilderStore2, querySelector]);
    const fallbackQuery = useMemo(() => createRuleGroup(), [createRuleGroup]);
    const candidateQuery = queryProp ?? storeQuery ?? defaultQueryProp ?? fallbackQuery;
    const rootGroup = candidateQuery.id ? candidateQuery : prepareRuleGroup(candidateQuery, { idGenerator });
    const [initialQuery] = useState(rootGroup);
    const rqbContext = useMemo(() => ({
      ...incomingRqbContext,
      initialQuery
    }), [incomingRqbContext, initialQuery]);
    useEffect(() => {
      if (!!queryProp && !Object.is(queryProp, storeQuery)) queryBuilderDispatch(_RQB_INTERNAL_dispatchThunk({
        payload: {
          qbId,
          query: queryProp
        },
        onQueryChange: void 0
      }));
    }, [
      queryProp,
      qbId,
      storeQuery,
      queryBuilderDispatch
    ]);
    const independentCombinators = useMemo(() => isRuleGroupTypeIC(rootGroup), [rootGroup]);
    const invalidIC = !!props.independentCombinators && !independentCombinators;
    useDeprecatedProps("independentCombinators", invalidIC || !invalidIC && (props.independentCombinators ?? "not present") !== "not present", invalidIC ? "invalid" : "unnecessary");
    const hasRunMountQueryChange = useRef(false);
    useEffect(() => {
      if (hasRunMountQueryChange.current) return;
      hasRunMountQueryChange.current = true;
      queryBuilderDispatch(_RQB_INTERNAL_dispatchThunk({
        payload: {
          qbId,
          query: rootGroup
        },
        onQueryChange: enableMountQueryChange && typeof onQueryChange === "function" ? onQueryChange : void 0
      }));
    }, [
      enableMountQueryChange,
      onQueryChange,
      qbId,
      queryBuilderDispatch,
      rootGroup
    ]);
    const dispatchQuery = useCallback((newQuery) => {
      queryBuilderDispatch(_RQB_INTERNAL_dispatchThunk({
        payload: {
          qbId,
          query: newQuery
        },
        onQueryChange
      }));
    }, [
      onQueryChange,
      qbId,
      queryBuilderDispatch
    ]);
    const disabledPaths = Array.isArray(disabled) && disabled || defaultDisabledPaths;
    const queryDisabled = disabled === true;
    const rootGroupDisabled = rootGroup.disabled || disabledPaths.some((p) => p.length === 0);
    const onRuleAdd = useCallback((rule, parentPath, context) => {
      const queryLocal = getQuerySelectorById(qbId)(queryBuilderStore2.getState());
      if (!queryLocal) return;
      if (pathIsDisabled(parentPath, queryLocal) || queryDisabled) {
        log({
          qbId,
          type: LogType.parentPathDisabled,
          rule,
          parentPath,
          query: queryLocal
        });
        return;
      }
      const nextRule = onAddRule(rule, parentPath, queryLocal, context);
      if (!nextRule) {
        log({
          qbId,
          type: LogType.onAddRuleFalse,
          rule,
          parentPath,
          query: queryLocal
        });
        return;
      }
      const newRule = nextRule === true ? rule : nextRule;
      const newQuery = add(queryLocal, newRule, parentPath, {
        combinators,
        combinatorPreceding: newRule.combinatorPreceding ?? void 0,
        idGenerator
      });
      log({
        qbId,
        type: LogType.add,
        query: queryLocal,
        newQuery,
        newRule,
        parentPath
      });
      dispatchQuery(newQuery);
    }, [
      combinators,
      dispatchQuery,
      idGenerator,
      log,
      onAddRule,
      qbId,
      queryBuilderStore2,
      queryDisabled
    ]);
    const onGroupAdd = useCallback((ruleGroup, parentPath, context) => {
      if (parentPath.length >= maxLevels) return;
      const queryLocal = getQuerySelectorById(qbId)(queryBuilderStore2.getState());
      if (!queryLocal) return;
      if (pathIsDisabled(parentPath, queryLocal) || queryDisabled) {
        log({
          qbId,
          type: LogType.parentPathDisabled,
          ruleGroup,
          parentPath,
          query: queryLocal
        });
        return;
      }
      const nextGroup = onAddGroup(ruleGroup, parentPath, queryLocal, context);
      if (!nextGroup) {
        log({
          qbId,
          type: LogType.onAddGroupFalse,
          ruleGroup,
          parentPath,
          query: queryLocal
        });
        return;
      }
      const newGroup = nextGroup === true ? ruleGroup : nextGroup;
      const newQuery = add(queryLocal, newGroup, parentPath, {
        combinators,
        combinatorPreceding: newGroup.combinatorPreceding ?? void 0,
        idGenerator
      });
      log({
        qbId,
        type: LogType.add,
        query: queryLocal,
        newQuery,
        newGroup,
        parentPath
      });
      dispatchQuery(newQuery);
    }, [
      combinators,
      dispatchQuery,
      idGenerator,
      log,
      maxLevels,
      onAddGroup,
      qbId,
      queryBuilderStore2,
      queryDisabled
    ]);
    const onPropChange = useCallback((prop, value, path) => {
      const queryLocal = getQuerySelectorById(qbId)(queryBuilderStore2.getState());
      if (!queryLocal) return;
      if (pathIsDisabled(path, queryLocal) && prop !== "disabled" || queryDisabled) {
        log({
          qbId,
          type: LogType.pathDisabled,
          path,
          prop,
          value,
          query: queryLocal
        });
        return;
      }
      const newQuery = update(queryLocal, prop, value, path, {
        resetOnFieldChange,
        resetOnOperatorChange,
        getRuleDefaultOperator,
        getValueSources: getValueSourcesMain,
        getRuleDefaultValue,
        getMatchModes: getMatchModesMain
      });
      log({
        qbId,
        type: LogType.update,
        query: queryLocal,
        newQuery,
        prop,
        value,
        path
      });
      dispatchQuery(newQuery);
    }, [
      dispatchQuery,
      getMatchModesMain,
      getRuleDefaultOperator,
      getRuleDefaultValue,
      getValueSourcesMain,
      log,
      qbId,
      queryBuilderStore2,
      queryDisabled,
      resetOnFieldChange,
      resetOnOperatorChange
    ]);
    const onRuleOrGroupRemove = useCallback((path, context) => {
      const queryLocal = getQuerySelectorById(qbId)(queryBuilderStore2.getState());
      if (!queryLocal) return;
      if (pathIsDisabled(path, queryLocal) || queryDisabled) {
        log({
          qbId,
          type: LogType.pathDisabled,
          path,
          query: queryLocal
        });
        return;
      }
      const ruleOrGroup = findPath(path, queryLocal);
      if (ruleOrGroup) if (onRemove(ruleOrGroup, path, queryLocal, context)) {
        const newQuery = remove(queryLocal, path);
        log({
          qbId,
          type: LogType.remove,
          query: queryLocal,
          newQuery,
          path,
          ruleOrGroup
        });
        dispatchQuery(newQuery);
      } else log({
        qbId,
        type: LogType.onRemoveFalse,
        ruleOrGroup,
        path,
        query: queryLocal
      });
    }, [
      dispatchQuery,
      log,
      onRemove,
      qbId,
      queryBuilderStore2,
      queryDisabled
    ]);
    const moveRule = useCallback((oldPath, newPath, clone, context) => {
      const queryLocal = getQuerySelectorById(qbId)(queryBuilderStore2.getState());
      if (!queryLocal) return;
      if (pathIsDisabled(oldPath, queryLocal) || queryDisabled) {
        log({
          qbId,
          type: LogType.pathDisabled,
          oldPath,
          newPath,
          query: queryLocal
        });
        return;
      }
      const nextQuery = move(queryLocal, oldPath, newPath, {
        clone,
        combinators,
        idGenerator
      });
      const ruleOrGroup = findPath(oldPath, queryLocal);
      const isGroup = isRuleGroup(ruleOrGroup);
      const callbackResult = (isGroup ? onMoveGroup : onMoveRule)(ruleOrGroup, oldPath, newPath, queryLocal, nextQuery, {
        clone,
        combinators
      }, context);
      if (!callbackResult) {
        log({
          qbId,
          type: isGroup ? LogType.onMoveGroupFalse : LogType.onMoveRuleFalse,
          ruleOrGroup,
          oldPath,
          newPath,
          clone,
          query: queryLocal,
          nextQuery
        });
        return;
      }
      const newQuery = isRuleGroup(callbackResult) ? callbackResult : nextQuery;
      log({
        qbId,
        type: LogType.move,
        query: queryLocal,
        newQuery,
        oldPath,
        newPath,
        clone
      });
      dispatchQuery(newQuery);
    }, [
      combinators,
      dispatchQuery,
      idGenerator,
      log,
      onMoveGroup,
      onMoveRule,
      qbId,
      queryBuilderStore2,
      queryDisabled
    ]);
    const groupRule = useCallback((sourcePath, targetPath, clone, context) => {
      const queryLocal = getQuerySelectorById(qbId)(queryBuilderStore2.getState());
      if (!queryLocal) return;
      if (pathIsDisabled(sourcePath, queryLocal) || queryDisabled) {
        log({
          qbId,
          type: LogType.pathDisabled,
          sourcePath,
          targetPath,
          query: queryLocal
        });
        return;
      }
      const nextQuery = group(queryLocal, sourcePath, targetPath, {
        clone,
        combinators,
        idGenerator
      });
      const ruleOrGroup = findPath(sourcePath, queryLocal);
      const isGroup = isRuleGroup(ruleOrGroup);
      const callbackResult = (isGroup ? onGroupGroup : onGroupRule)(ruleOrGroup, sourcePath, targetPath, queryLocal, nextQuery, {
        clone,
        combinators
      }, context);
      if (!callbackResult) {
        log({
          qbId,
          type: isGroup ? LogType.onGroupGroupFalse : LogType.onGroupRuleFalse,
          ruleOrGroup,
          sourcePath,
          targetPath,
          clone,
          query: queryLocal,
          nextQuery
        });
        return;
      }
      const newQuery = isRuleGroup(callbackResult) ? callbackResult : nextQuery;
      log({
        qbId,
        type: LogType.group,
        query: queryLocal,
        newQuery,
        sourcePath,
        targetPath,
        clone
      });
      dispatchQuery(newQuery);
    }, [
      combinators,
      dispatchQuery,
      idGenerator,
      log,
      onGroupGroup,
      onGroupRule,
      qbId,
      queryBuilderStore2,
      queryDisabled
    ]);
    const { validationResult, validationMap } = useMemo(() => {
      const vr = typeof validator === "function" && rootGroup ? validator(rootGroup) : defaultValidationResult;
      return {
        validationResult: vr,
        validationMap: typeof vr === "boolean" ? defaultValidationMap : vr
      };
    }, [rootGroup, validator]);
    const dndEnabledAttr = enableDragAndDrop ? "enabled" : "disabled";
    const inlineCombinatorsAttr = independentCombinators || showCombinatorsBetweenRules ? "enabled" : "disabled";
    const combinatorPropObject = useMemo(() => typeof rootGroup.combinator === "string" ? { combinator: rootGroup.combinator } : icCombinatorPropObject, [rootGroup.combinator]);
    const wrapperClassName = useMemo(() => clsx(suppressStandardClassnames || standardClassnames.queryBuilder, clsx(controlClassnames.queryBuilder), queryDisabled && controlClassnames.disabled, typeof validationResult === "boolean" && validationResult && controlClassnames.valid, typeof validationResult === "boolean" && !validationResult && controlClassnames.invalid, suppressStandardClassnames || {
      [standardClassnames.disabled]: queryDisabled,
      [standardClassnames.valid]: typeof validationResult === "boolean" && validationResult,
      [standardClassnames.invalid]: typeof validationResult === "boolean" && !validationResult
    }), [
      controlClassnames.disabled,
      controlClassnames.invalid,
      controlClassnames.queryBuilder,
      controlClassnames.valid,
      queryDisabled,
      suppressStandardClassnames,
      validationResult
    ]);
    const createRuleGroupOverride = useCallback((ic) => createRuleGroup(ic ?? independentCombinators), [createRuleGroup, independentCombinators]);
    const schema = useMemo(() => ({
      addRuleToNewGroups,
      accessibleDescriptionGenerator,
      autoSelectField,
      autoSelectOperator,
      autoSelectValue,
      classNames: controlClassnames,
      combinators,
      controls,
      createRule,
      createRuleGroup: createRuleGroupOverride,
      disabledPaths,
      enableDragAndDrop,
      fieldMap,
      fields,
      dispatchQuery,
      getQuery,
      getInputType: getInputTypeMain,
      getOperators: getOperatorsMain,
      getMatchModes: getMatchModesMain,
      getRuleClassname,
      getRuleGroupClassname,
      getSubQueryBuilderProps: getSubQueryBuilderPropsMain,
      getValueEditorSeparator,
      getValueEditorType: getValueEditorTypeMain,
      getValues: getValuesMain,
      getValueSources: getValueSourcesMain,
      independentCombinators,
      listsAsArrays,
      maxLevels,
      parseNumbers,
      qbId,
      showCloneButtons,
      showCombinatorsBetweenRules,
      showLockButtons,
      showMuteButtons,
      showNotToggle,
      showShiftActions,
      suppressStandardClassnames,
      validationMap
    }), [
      accessibleDescriptionGenerator,
      addRuleToNewGroups,
      autoSelectField,
      autoSelectOperator,
      autoSelectValue,
      combinators,
      controlClassnames,
      controls,
      createRule,
      createRuleGroupOverride,
      disabledPaths,
      dispatchQuery,
      enableDragAndDrop,
      fieldMap,
      fields,
      getInputTypeMain,
      getOperatorsMain,
      getMatchModesMain,
      getQuery,
      getRuleClassname,
      getRuleGroupClassname,
      getSubQueryBuilderPropsMain,
      getValueEditorSeparator,
      getValueEditorTypeMain,
      getValuesMain,
      getValueSourcesMain,
      independentCombinators,
      listsAsArrays,
      maxLevels,
      parseNumbers,
      qbId,
      showCloneButtons,
      showCombinatorsBetweenRules,
      showLockButtons,
      showMuteButtons,
      showNotToggle,
      showShiftActions,
      suppressStandardClassnames,
      validationMap
    ]);
    return {
      actions: useMemo(() => ({
        moveRule,
        onGroupAdd,
        onGroupRemove: onRuleOrGroupRemove,
        onPropChange,
        onRuleAdd,
        onRuleRemove: onRuleOrGroupRemove,
        groupRule
      }), [
        groupRule,
        moveRule,
        onGroupAdd,
        onPropChange,
        onRuleAdd,
        onRuleOrGroupRemove
      ]),
      rootGroup,
      rootGroupDisabled,
      queryDisabled,
      rqbContext,
      schema,
      translations,
      wrapperClassName,
      dndEnabledAttr,
      inlineCombinatorsAttr,
      combinatorPropObject
    };
  }
  var getFirstOptionsFrom = (opts, r, listsAsArrays) => {
    const firstOption = getFirstOption(opts);
    if (r.operator === "between" || r.operator === "notBetween") {
      const valueAsArray = [firstOption, firstOption];
      return listsAsArrays ? valueAsArray : joinWith(valueAsArray.map((v) => v ?? ""), ",");
    }
    return firstOption;
  };
  var useQueryBuilderSetup = (props) => {
    const [qbId] = useState(generateID);
    const { fields: fieldsProp, baseField, operators: operatorsProp, baseOperator, combinators: combinatorsProp, baseCombinator, translations: translationsProp, enableMountQueryChange: enableMountQueryChangeProp = true, controlClassnames: controlClassnamesProp, controlElements: controlElementsProp, getDefaultField, getDefaultOperator, getDefaultValue, getMatchModes, getOperators, getSubQueryBuilderProps, getValueEditorType, getValueSources, getInputType, getValues, autoSelectField = true, autoSelectOperator = true, autoSelectValue = true, addRuleToNewGroups = false, enableDragAndDrop: enableDragAndDropProp, listsAsArrays = false, debugMode: debugModeProp = false, idGenerator = generateID } = props;
    const [initialQueryProp] = useState(props.query ?? props.defaultQuery);
    const rqbContext = useMergedContext({
      controlClassnames: controlClassnamesProp,
      controlElements: controlElementsProp,
      debugMode: debugModeProp,
      enableDragAndDrop: enableDragAndDropProp,
      enableMountQueryChange: enableMountQueryChangeProp,
      translations: translationsProp,
      initialQuery: initialQueryProp,
      qbId,
      finalize: true
    });
    const { translations } = rqbContext;
    const { fields, fieldMap } = useFields({
      fields: fieldsProp,
      baseField,
      autoSelectField,
      translations
    });
    const { optionList: combinators } = useMemo(() => prepareOptionList({
      optionList: combinatorsProp ?? defaultCombinators,
      labelMap: defaultCombinatorLabelMap,
      baseOption: baseCombinator,
      autoSelectOption: true
    }), [baseCombinator, combinatorsProp]);
    const { optionList: operators } = useMemo(() => prepareOptionList({
      optionList: operatorsProp ?? defaultOperators,
      placeholder: translations.operators,
      labelMap: defaultOperatorLabelMap,
      baseOption: baseOperator,
      autoSelectOption: autoSelectOperator
    }), [
      autoSelectOperator,
      baseOperator,
      operatorsProp,
      translations.operators
    ]);
    const getOperatorsMain = useCallback((field, { fieldData }) => prepareOptionList({
      optionList: fieldData?.operators ?? getOperators?.(field, { fieldData }) ?? operators,
      placeholder: translations.operators,
      baseOption: baseOperator,
      labelMap: defaultOperatorLabelMap,
      autoSelectOption: autoSelectOperator
    }).optionList, [
      autoSelectOperator,
      baseOperator,
      getOperators,
      operators,
      translations.operators
    ]);
    const getRuleDefaultOperator = useCallback((field) => {
      const fieldData = fieldMap[field];
      if (fieldData?.defaultOperator) return fieldData.defaultOperator;
      if (getDefaultOperator) return typeof getDefaultOperator === "function" ? getDefaultOperator(field, { fieldData }) : getDefaultOperator;
      return getFirstOption(getOperatorsMain(field, { fieldData }) ?? []) ?? "";
    }, [
      fieldMap,
      getDefaultOperator,
      getOperatorsMain
    ]);
    const getValueEditorTypeMain = useCallback((field, operator, { fieldData }) => {
      if (fieldData.valueEditorType) {
        if (typeof fieldData.valueEditorType === "function") return fieldData.valueEditorType(operator);
        return fieldData.valueEditorType;
      }
      return getValueEditorType?.(field, operator, { fieldData }) ?? "text";
    }, [getValueEditorType]);
    const getValueSourcesMain = useCallback((field, operator, _misc) => getValueSourcesUtil(fieldMap[field], operator, getValueSources), [fieldMap, getValueSources]);
    const getMatchModesMain = useCallback((field, _misc) => getMatchModesUtil(fieldMap[field], getMatchModes), [fieldMap, getMatchModes]);
    const getSubQueryBuilderPropsMain = useCallback((field, misc) => getSubQueryBuilderProps?.(field, misc) ?? {}, [getSubQueryBuilderProps]);
    const getValuesMain = useCallback((field, operator, { fieldData }) => prepareOptionList({
      optionList: fieldData?.values ?? getValues?.(field, operator, { fieldData }) ?? [],
      placeholder: translations.values,
      autoSelectOption: autoSelectValue
    }).optionList, [
      autoSelectValue,
      getValues,
      translations.values
    ]);
    const getRuleDefaultValue = useCallback((r) => {
      const fieldData = fieldMap[r.field] ?? {};
      if (fieldData?.defaultValue !== void 0 && fieldData.defaultValue !== null) return fieldData.defaultValue;
      else if (getDefaultValue) return getDefaultValue(r, { fieldData });
      let value = "";
      const values = getValuesMain(r.field, r.operator, { fieldData });
      if (r.valueSource === "field") {
        const filteredFields = filterFieldsByComparator(fieldData, fields, r.operator);
        value = filteredFields.length > 0 ? getFirstOptionsFrom(filteredFields, r, listsAsArrays) : "";
      } else if (values.length > 0) {
        const editorType = getValueEditorTypeMain(r.field, r.operator, { fieldData });
        if (editorType === "multiselect") value = listsAsArrays ? [] : "";
        else if (editorType === "select" || editorType === "radio") value = getFirstOptionsFrom(values, r, listsAsArrays);
      } else if (getValueEditorTypeMain(r.field, r.operator, { fieldData }) === "checkbox") value = false;
      return value;
    }, [
      fieldMap,
      fields,
      getDefaultValue,
      getValueEditorTypeMain,
      getValuesMain,
      listsAsArrays
    ]);
    const getInputTypeMain = useCallback((field, operator, { fieldData }) => {
      if (getInputType) {
        const inputType = getInputType(field, operator, { fieldData });
        if (inputType) return inputType;
      }
      return "text";
    }, [getInputType]);
    const createRule = useCallback(() => {
      let field = "";
      const flds = fields;
      if (flds?.length > 0 && flds[0]) {
        const fo = getFirstOption(flds);
        if (fo) field = fo;
      }
      if (getDefaultField) if (typeof getDefaultField === "function") {
        const df = getDefaultField(flds);
        if (df) field = df;
      } else field = getDefaultField;
      const operator = getRuleDefaultOperator(field);
      const valueSource = getFirstOption(getValueSourcesMain(field, operator, { fieldData: getOption(flds, field) })) ?? "value";
      const matchMode = getFirstOption(getMatchModesMain(field, { fieldData: getOption(flds, field) }));
      const newRule = {
        id: idGenerator(),
        field,
        operator,
        valueSource,
        value: "",
        ...matchMode ? { match: {
          mode: matchMode,
          threshold: 1
        } } : null
      };
      const value = getRuleDefaultValue(newRule);
      return {
        ...newRule,
        value
      };
    }, [
      fields,
      getDefaultField,
      getMatchModesMain,
      getRuleDefaultOperator,
      getRuleDefaultValue,
      getValueSourcesMain,
      idGenerator
    ]);
    return {
      qbId,
      rqbContext,
      fields,
      fieldMap,
      combinators,
      getMatchModesMain,
      getOperatorsMain,
      getRuleDefaultOperator,
      getSubQueryBuilderPropsMain,
      getValueEditorTypeMain,
      getValueSourcesMain,
      getValuesMain,
      getRuleDefaultValue,
      getInputTypeMain,
      createRule,
      createRuleGroup: useCallback((independentCombinators) => {
        if (independentCombinators) return {
          id: idGenerator(),
          rules: addRuleToNewGroups ? [createRule()] : [],
          not: false
        };
        return {
          id: idGenerator(),
          rules: addRuleToNewGroups ? [createRule()] : [],
          combinator: getFirstOption(combinators) ?? "",
          not: false
        };
      }, [
        addRuleToNewGroups,
        combinators,
        createRule,
        idGenerator
      ])
    };
  };
  var useQueryBuilder = (props) => useQueryBuilderSchema(props, useQueryBuilderSetup(props));
  var QueryBuilderContext = createContext({});
  var RuleGroup = memo(function RuleGroup2(props) {
    const rg = useRuleGroup(props);
    const { schema: { controls: { ruleGroupBodyElements: RuleGroupBodyElements, ruleGroupHeaderElements: RuleGroupHeaderElements } } } = rg;
    const addRule = useStopEventPropagation(rg.addRule);
    const addGroup = useStopEventPropagation(rg.addGroup);
    const cloneGroup = useStopEventPropagation(rg.cloneGroup);
    const toggleLockGroup = useStopEventPropagation(rg.toggleLockGroup);
    const toggleMuteGroup = useStopEventPropagation(rg.toggleMuteGroup);
    const removeGroup = useStopEventPropagation(rg.removeGroup);
    const shiftGroupUp = useStopEventPropagation(rg.shiftGroupUp);
    const shiftGroupDown = useStopEventPropagation(rg.shiftGroupDown);
    const actions = useMemo(() => ({
      addRule,
      addGroup,
      cloneGroup,
      toggleLockGroup,
      toggleMuteGroup,
      removeGroup,
      shiftGroupUp,
      shiftGroupDown
    }), [
      addRule,
      addGroup,
      cloneGroup,
      toggleLockGroup,
      toggleMuteGroup,
      removeGroup,
      shiftGroupUp,
      shiftGroupDown
    ]);
    return /* @__PURE__ */ createElement("div", {
      ref: rg.previewRef,
      title: rg.accessibleDescription,
      className: rg.outerClassName,
      "data-testid": TestID.ruleGroup,
      "data-not": rg.ruleGroup.not ? "true" : void 0,
      "data-dragmonitorid": rg.dragMonitorId,
      "data-dropmonitorid": rg.dropMonitorId,
      "data-rule-group-id": rg.id,
      "data-level": rg.path.length,
      "data-path": JSON.stringify(rg.path)
    }, /* @__PURE__ */ createElement("div", {
      ref: rg.dropRef,
      className: rg.classNames.header
    }, /* @__PURE__ */ createElement(RuleGroupHeaderElements, {
      ...rg,
      ...actions
    })), /* @__PURE__ */ createElement("div", { className: rg.classNames.body }, /* @__PURE__ */ createElement(RuleGroupBodyElements, {
      ...rg,
      ...actions
    })));
  });
  var RuleGroupHeaderComponents = memo(function RuleGroupHeaderComponents2(rg) {
    const { schema: { controls: { shiftActions: ShiftActionsControlElement, dragHandle: DragHandleControlElement, combinatorSelector: CombinatorSelectorControlElement, notToggle: NotToggleControlElement, addRuleAction: AddRuleActionControlElement, addGroupAction: AddGroupActionControlElement, cloneGroupAction: CloneGroupActionControlElement, lockGroupAction: LockGroupActionControlElement, muteGroupAction: MuteGroupActionControlElement, removeGroupAction: RemoveGroupActionControlElement } } } = rg;
    const commonSubcomponentProps = useMemo(() => ({
      level: rg.path.length,
      path: rg.path,
      disabled: rg.disabled,
      context: rg.context,
      validation: rg.validationResult,
      schema: rg.schema
    }), [
      rg.path,
      rg.disabled,
      rg.context,
      rg.validationResult,
      rg.schema
    ]);
    const shiftTitles = useMemo(() => rg.schema.showShiftActions ? {
      shiftUp: rg.translations.shiftActionUp.title,
      shiftDown: rg.translations.shiftActionDown.title
    } : void 0, [rg.schema.showShiftActions, rg.translations]);
    const shiftLabels = useMemo(() => rg.schema.showShiftActions ? {
      shiftUp: rg.translations.shiftActionUp.label,
      shiftDown: rg.translations.shiftActionDown.label
    } : void 0, [rg.schema.showShiftActions, rg.translations]);
    return /* @__PURE__ */ createElement(Fragment, null, rg.schema.showShiftActions && rg.path.length > 0 && /* @__PURE__ */ createElement(ShiftActionsControlElement, {
      key: TestID.shiftActions,
      ...commonSubcomponentProps,
      testID: TestID.shiftActions,
      titles: shiftTitles,
      labels: shiftLabels,
      className: rg.classNames.shiftActions,
      shiftUp: rg.shiftGroupUp,
      shiftDown: rg.shiftGroupDown,
      shiftUpDisabled: rg.shiftUpDisabled,
      shiftDownDisabled: rg.shiftDownDisabled,
      ruleOrGroup: rg.ruleGroup
    }), rg.path.length > 0 && rg.schema.enableDragAndDrop && /* @__PURE__ */ createElement(DragHandleControlElement, {
      key: TestID.dragHandle,
      ...commonSubcomponentProps,
      testID: TestID.dragHandle,
      ref: rg.dragRef,
      title: rg.translations.dragHandle.title,
      label: rg.translations.dragHandle.label,
      className: rg.classNames.dragHandle,
      ruleOrGroup: rg.ruleGroup
    }), !rg.schema.showCombinatorsBetweenRules && !rg.schema.independentCombinators && /* @__PURE__ */ createElement(CombinatorSelectorControlElement, {
      key: TestID.combinators,
      ...commonSubcomponentProps,
      testID: TestID.combinators,
      options: rg.schema.combinators,
      value: rg.combinator,
      title: rg.translations.combinators.title,
      className: rg.classNames.combinators,
      handleOnChange: rg.onCombinatorChange,
      rules: rg.ruleGroup.rules,
      ruleGroup: rg.ruleGroup
    }), rg.schema.showNotToggle && /* @__PURE__ */ createElement(NotToggleControlElement, {
      key: TestID.notToggle,
      ...commonSubcomponentProps,
      testID: TestID.notToggle,
      className: rg.classNames.notToggle,
      title: rg.translations.notToggle.title,
      label: rg.translations.notToggle.label,
      checked: rg.ruleGroup.not,
      handleOnChange: rg.onNotToggleChange,
      ruleGroup: rg.ruleGroup
    }), /* @__PURE__ */ createElement(AddRuleActionControlElement, {
      key: TestID.addRule,
      ...commonSubcomponentProps,
      testID: TestID.addRule,
      label: rg.translations.addRule.label,
      title: rg.translations.addRule.title,
      className: rg.classNames.addRule,
      handleOnClick: rg.addRule,
      rules: rg.ruleGroup.rules,
      ruleOrGroup: rg.ruleGroup
    }), rg.schema.maxLevels > rg.path.length && /* @__PURE__ */ createElement(AddGroupActionControlElement, {
      key: TestID.addGroup,
      ...commonSubcomponentProps,
      testID: TestID.addGroup,
      label: rg.translations.addGroup.label,
      title: rg.translations.addGroup.title,
      className: rg.classNames.addGroup,
      handleOnClick: rg.addGroup,
      rules: rg.ruleGroup.rules,
      ruleOrGroup: rg.ruleGroup
    }), rg.schema.showCloneButtons && rg.path.length > 0 && /* @__PURE__ */ createElement(CloneGroupActionControlElement, {
      key: TestID.cloneGroup,
      ...commonSubcomponentProps,
      testID: TestID.cloneGroup,
      label: rg.translations.cloneRuleGroup.label,
      title: rg.translations.cloneRuleGroup.title,
      className: rg.classNames.cloneGroup,
      handleOnClick: rg.cloneGroup,
      rules: rg.ruleGroup.rules,
      ruleOrGroup: rg.ruleGroup
    }), rg.schema.showLockButtons && /* @__PURE__ */ createElement(LockGroupActionControlElement, {
      key: TestID.lockGroup,
      ...commonSubcomponentProps,
      testID: TestID.lockGroup,
      label: rg.translations.lockGroup.label,
      title: rg.translations.lockGroup.title,
      className: rg.classNames.lockGroup,
      handleOnClick: rg.toggleLockGroup,
      rules: rg.ruleGroup.rules,
      disabledTranslation: rg.parentDisabled ? void 0 : rg.translations.lockGroupDisabled,
      ruleOrGroup: rg.ruleGroup
    }), rg.schema.showMuteButtons && /* @__PURE__ */ createElement(MuteGroupActionControlElement, {
      key: TestID.muteGroup,
      ...commonSubcomponentProps,
      testID: TestID.muteGroup,
      label: rg.ruleGroup.muted ? rg.translations.unmuteGroup.label : rg.translations.muteGroup.label,
      title: rg.ruleGroup.muted ? rg.translations.unmuteGroup.title : rg.translations.muteGroup.title,
      className: rg.classNames.muteGroup,
      handleOnClick: rg.toggleMuteGroup,
      rules: rg.ruleGroup.rules,
      ruleOrGroup: rg.ruleGroup
    }), rg.path.length > 0 && /* @__PURE__ */ createElement(RemoveGroupActionControlElement, {
      key: TestID.removeGroup,
      ...commonSubcomponentProps,
      testID: TestID.removeGroup,
      label: rg.translations.removeGroup.label,
      title: rg.translations.removeGroup.title,
      className: rg.classNames.removeGroup,
      handleOnClick: rg.removeGroup,
      rules: rg.ruleGroup.rules,
      ruleOrGroup: rg.ruleGroup
    }));
  });
  var RuleGroupBodyComponents = memo(function RuleGroupBodyComponents2(rg) {
    const { schema: { controls: { combinatorSelector: CombinatorSelectorControlElement, inlineCombinator: InlineCombinatorControlElement, ruleGroup: RuleGroupControlElement, rule: RuleControlElement } } } = rg;
    return /* @__PURE__ */ createElement(Fragment, null, rg.ruleGroup.rules.map((r, idx, { length: ruleArrayLength }) => {
      const thisPathMemo = rg.pathsMemo[idx];
      const thisPath = thisPathMemo.path;
      const thisPathDisabled = thisPathMemo.disabled || typeof r !== "string" && r.disabled;
      const shiftUpDisabled = pathsAreEqual([0], thisPath);
      const shiftDownDisabled = rg.path.length === 0 && idx === ruleArrayLength - 1;
      const key = typeof r === "string" ? [...thisPath, r].join("-") : r.id;
      return /* @__PURE__ */ createElement(Fragment, { key }, idx > 0 && !rg.schema.independentCombinators && rg.schema.showCombinatorsBetweenRules && /* @__PURE__ */ createElement(InlineCombinatorControlElement, {
        key: TestID.inlineCombinator,
        options: rg.schema.combinators,
        value: rg.combinator,
        title: rg.translations.combinators.title,
        className: rg.classNames.combinators,
        handleOnChange: rg.onCombinatorChange,
        rules: rg.ruleGroup.rules,
        level: rg.path.length,
        context: rg.context,
        validation: rg.validationResult,
        component: CombinatorSelectorControlElement,
        path: thisPath,
        disabled: rg.disabled,
        schema: rg.schema,
        ruleGroup: rg.ruleGroup
      }), typeof r === "string" ? /* @__PURE__ */ createElement(InlineCombinatorControlElement, {
        key: `${TestID.inlineCombinator}-independent`,
        options: rg.schema.combinators,
        value: r,
        title: rg.translations.combinators.title,
        className: rg.classNames.combinators,
        handleOnChange: (val) => rg.onIndependentCombinatorChange(val, idx),
        rules: rg.ruleGroup.rules,
        level: rg.path.length,
        context: rg.context,
        validation: rg.validationResult,
        component: CombinatorSelectorControlElement,
        path: thisPath,
        disabled: thisPathDisabled,
        schema: rg.schema,
        ruleGroup: rg.ruleGroup
      }) : isRuleGroup(r) ? /* @__PURE__ */ createElement(RuleGroupControlElement, {
        key: TestID.ruleGroup,
        id: r.id,
        schema: rg.schema,
        actions: rg.actions,
        path: thisPath,
        translations: rg.translations,
        ruleGroup: r,
        rules: r.rules,
        combinator: isRuleGroupType(r) ? r.combinator : void 0,
        not: !!r.not,
        disabled: thisPathDisabled,
        parentDisabled: rg.parentDisabled || rg.disabled,
        parentMuted: rg.parentMuted || rg.muted,
        shiftUpDisabled,
        shiftDownDisabled,
        context: rg.context
      }) : /* @__PURE__ */ createElement(RuleControlElement, {
        key: TestID.rule,
        id: r.id,
        rule: r,
        field: r.field,
        operator: r.operator,
        value: r.value,
        valueSource: r.valueSource,
        schema: rg.schema,
        actions: rg.actions,
        path: thisPath,
        disabled: thisPathDisabled,
        parentDisabled: rg.parentDisabled || rg.disabled,
        parentMuted: rg.parentMuted || rg.muted,
        translations: rg.translations,
        shiftUpDisabled,
        shiftDownDisabled,
        context: rg.context
      }));
    }));
  });
  var useRuleGroup = (props) => {
    const { id, path, ruleGroup: ruleGroupProp, schema: { qbId, accessibleDescriptionGenerator, classNames: classNamesProp, combinators, createRule, createRuleGroup, disabledPaths, independentCombinators, validationMap, enableDragAndDrop, getRuleGroupClassname, suppressStandardClassnames }, actions: { onGroupAdd, onGroupRemove, onPropChange, onRuleAdd, moveRule }, disabled: disabledProp, parentDisabled, parentMuted, shiftUpDisabled, shiftDownDisabled, combinator: combinatorProp, rules: rulesProp, not: notProp, dropEffect = "move", groupItems = false, dragMonitorId = "", dropMonitorId = "", previewRef = null, dragRef = null, dropRef = null, isDragging = false, isOver = false, dropNotAllowed = false } = props;
    useDeprecatedProps("ruleGroup", !ruleGroupProp);
    useReactDndWarning(enableDragAndDrop, !!(dragMonitorId || dropMonitorId || previewRef || dragRef || dropRef));
    const disabled = !!parentDisabled || !!disabledProp;
    const muted = !!parentMuted || !!ruleGroupProp?.muted;
    const combinator = useMemo(() => ruleGroupProp && isRuleGroupType(ruleGroupProp) ? ruleGroupProp.combinator : ruleGroupProp ? getFirstOption(combinators) : combinatorProp ?? getFirstOption(combinators), [
      combinatorProp,
      combinators,
      ruleGroupProp
    ]);
    const ruleGroup = useMemo(() => {
      if (ruleGroupProp) {
        if (ruleGroupProp.combinator === combinator || independentCombinators) return ruleGroupProp;
        const newRG = structuredClone(ruleGroupProp);
        newRG.combinator = combinator;
        return newRG;
      }
      return {
        rules: rulesProp,
        not: notProp
      };
    }, [
      combinator,
      independentCombinators,
      notProp,
      ruleGroupProp,
      rulesProp
    ]);
    const classNames = useMemo(() => ({
      header: clsx(suppressStandardClassnames || standardClassnames.header, classNamesProp.header, isOver && dropEffect === "copy" && classNamesProp.dndCopy, dropNotAllowed && classNamesProp.dndDropNotAllowed, suppressStandardClassnames || {
        [standardClassnames.dndOver]: isOver,
        [standardClassnames.dndCopy]: isOver && dropEffect === "copy",
        [standardClassnames.dndDropNotAllowed]: dropNotAllowed
      }),
      shiftActions: clsx(suppressStandardClassnames || standardClassnames.shiftActions, classNamesProp.shiftActions),
      dragHandle: clsx(suppressStandardClassnames || standardClassnames.dragHandle, classNamesProp.dragHandle),
      combinators: clsx(suppressStandardClassnames || standardClassnames.combinators, classNamesProp.valueSelector, classNamesProp.combinators),
      notToggle: clsx(suppressStandardClassnames || standardClassnames.notToggle, classNamesProp.notToggle),
      addRule: clsx(suppressStandardClassnames || standardClassnames.addRule, classNamesProp.actionElement, classNamesProp.addRule),
      addGroup: clsx(suppressStandardClassnames || standardClassnames.addGroup, classNamesProp.actionElement, classNamesProp.addGroup),
      cloneGroup: clsx(suppressStandardClassnames || standardClassnames.cloneGroup, classNamesProp.actionElement, classNamesProp.cloneGroup),
      lockGroup: clsx(suppressStandardClassnames || standardClassnames.lockGroup, classNamesProp.actionElement, classNamesProp.lockGroup),
      muteGroup: clsx(suppressStandardClassnames || standardClassnames.muteGroup, classNamesProp.actionElement, classNamesProp.muteGroup),
      removeGroup: clsx(suppressStandardClassnames || standardClassnames.removeGroup, classNamesProp.actionElement, classNamesProp.removeGroup),
      body: clsx(suppressStandardClassnames || standardClassnames.body, classNamesProp.body)
    }), [
      classNamesProp.actionElement,
      classNamesProp.addGroup,
      classNamesProp.addRule,
      classNamesProp.body,
      classNamesProp.cloneGroup,
      classNamesProp.combinators,
      classNamesProp.dndCopy,
      classNamesProp.dndDropNotAllowed,
      classNamesProp.dragHandle,
      classNamesProp.header,
      classNamesProp.lockGroup,
      classNamesProp.muteGroup,
      classNamesProp.notToggle,
      classNamesProp.removeGroup,
      classNamesProp.shiftActions,
      classNamesProp.valueSelector,
      dropEffect,
      dropNotAllowed,
      isOver,
      suppressStandardClassnames
    ]);
    const onCombinatorChange = useCallback((value) => {
      if (!disabled) onPropChange("combinator", value, path);
    }, [
      disabled,
      onPropChange,
      path
    ]);
    const onIndependentCombinatorChange = useCallback((value, index, _context) => {
      if (!disabled) onPropChange("combinator", value, [...path, index]);
    }, [
      disabled,
      onPropChange,
      path
    ]);
    const onNotToggleChange = useCallback((checked, _context) => {
      if (!disabled) onPropChange("not", checked, path);
    }, [
      disabled,
      onPropChange,
      path
    ]);
    const addRule = useCallback((_e, context) => {
      if (!disabled) onRuleAdd(createRule(), path, context);
    }, [
      createRule,
      disabled,
      onRuleAdd,
      path
    ]);
    const addGroup = useCallback((_e, context) => {
      if (!disabled) onGroupAdd(createRuleGroup(), path, context);
    }, [
      createRuleGroup,
      disabled,
      onGroupAdd,
      path
    ]);
    const cloneGroup = useCallback(() => {
      if (!disabled) moveRule(path, [...getParentPath(path), path.at(-1) + 1], true);
    }, [
      disabled,
      moveRule,
      path
    ]);
    const shiftGroupUp = useCallback((event, _context) => {
      if (!disabled && !shiftUpDisabled) moveRule(path, "up", event?.altKey);
    }, [
      disabled,
      moveRule,
      path,
      shiftUpDisabled
    ]);
    const shiftGroupDown = useCallback((event, _context) => {
      if (!disabled && !shiftDownDisabled) moveRule(path, "down", event?.altKey);
    }, [
      disabled,
      moveRule,
      path,
      shiftDownDisabled
    ]);
    const toggleLockGroup = useCallback(() => {
      onPropChange("disabled", !disabled, path);
    }, [
      disabled,
      onPropChange,
      path
    ]);
    const toggleMuteGroup = useCallback(() => {
      onPropChange("muted", !ruleGroup.muted, path);
    }, [
      ruleGroup.muted,
      onPropChange,
      path
    ]);
    const removeGroup = useCallback(() => {
      if (!disabled) onGroupRemove(path);
    }, [
      disabled,
      onGroupRemove,
      path
    ]);
    const validationResult = validationMap[id ?? ""];
    const validationClassName = useMemo(() => getValidationClassNames(validationResult), [validationResult]);
    const combinatorBasedClassName = useMemo(() => independentCombinators ? null : getOption(combinators, combinator)?.className ?? "", [
      combinator,
      combinators,
      independentCombinators
    ]);
    const ruleGroupClassname = useMemo(() => getRuleGroupClassname(ruleGroup), [getRuleGroupClassname, ruleGroup]);
    const outerClassName = useMemo(() => clsx(ruleGroupClassname, combinatorBasedClassName, suppressStandardClassnames || standardClassnames.ruleGroup, classNamesProp.ruleGroup, disabled && classNamesProp.disabled, muted && classNamesProp.muted, isDragging && classNamesProp.dndDragging, isOver && groupItems && classNamesProp.dndGroup, suppressStandardClassnames || {
      [standardClassnames.disabled]: disabled,
      [standardClassnames.muted]: muted,
      [standardClassnames.dndDragging]: isDragging,
      [standardClassnames.dndGroup]: isOver && groupItems
    }, validationClassName), [
      classNamesProp.disabled,
      classNamesProp.muted,
      classNamesProp.dndDragging,
      classNamesProp.dndGroup,
      classNamesProp.ruleGroup,
      combinatorBasedClassName,
      disabled,
      muted,
      groupItems,
      isDragging,
      isOver,
      ruleGroupClassname,
      suppressStandardClassnames,
      validationClassName
    ]);
    const pathsMemo = usePathsMemo({
      disabled,
      disabledPaths,
      path,
      nestedArray: ruleGroup.rules
    });
    const accessibleDescription = useMemo(() => accessibleDescriptionGenerator({
      path,
      qbId
    }), [
      accessibleDescriptionGenerator,
      path,
      qbId
    ]);
    return {
      ...props,
      addGroup,
      addRule,
      accessibleDescription,
      classNames,
      cloneGroup,
      combinator,
      disabled,
      dragMonitorId,
      dragRef,
      dropMonitorId,
      dropRef,
      isDragging,
      isOver,
      muted,
      onCombinatorChange,
      onGroupAdd,
      onIndependentCombinatorChange,
      onNotToggleChange,
      outerClassName,
      parentDisabled,
      pathsMemo,
      previewRef,
      removeGroup,
      ruleGroup,
      shiftGroupUp,
      shiftGroupDown,
      toggleLockGroup,
      toggleMuteGroup,
      validationClassName,
      validationResult
    };
  };
  var ShiftActions = (props) => /* @__PURE__ */ createElement("div", {
    "data-testid": props.testID,
    className: props.className
  }, /* @__PURE__ */ createElement("button", {
    disabled: props.disabled || props.shiftUpDisabled,
    onClick: props.shiftUp,
    title: props.titles?.shiftUp
  }, props.labels?.shiftUp), /* @__PURE__ */ createElement("button", {
    disabled: props.disabled || props.shiftDownDisabled,
    onClick: props.shiftDown,
    title: props.titles?.shiftDown
  }, props.labels?.shiftDown));
  var RadioButton = ({ name, disabled, checked, label, handleOnChange }) => {
    const id = useId();
    return /* @__PURE__ */ createElement("label", { htmlFor: id }, /* @__PURE__ */ createElement("input", {
      id,
      type: "radio",
      value: name,
      disabled,
      checked,
      onChange: (e) => handleOnChange(e.target.value)
    }), label);
  };
  var ValueEditor = (allProps) => {
    const { operator, value, handleOnChange, title, className, type = "text", inputType, values = [], listsAsArrays, fieldData, disabled, separator = null, testID, selectorComponent: SelectorComponent = allProps.schema.controls.valueSelector, parseNumbers: _parseNumbers, skipHook: _skipHook, valueSource: _valueSource, ...propsForValueSelector } = allProps;
    const { valueAsArray, multiValueHandler, bigIntValueHandler, parseNumberMethod, valueListItemClassName, inputTypeCoerced } = useValueEditor(allProps);
    if (operator === "null" || operator === "notNull") return null;
    const placeHolderText = fieldData?.placeholder ?? "";
    if ((operator === "between" || operator === "notBetween") && (type === "select" || type === "text")) {
      const editors = ["from", "to"].map((key, i) => {
        if (type === "text") return /* @__PURE__ */ createElement("input", {
          key,
          type: inputTypeCoerced,
          placeholder: placeHolderText,
          value: valueAsArray[i] ?? "",
          className: valueListItemClassName,
          disabled,
          onChange: (e) => multiValueHandler(e.target.value, i)
        });
        return /* @__PURE__ */ createElement(SelectorComponent, {
          key,
          ...propsForValueSelector,
          schema: allProps.schema,
          className: valueListItemClassName,
          handleOnChange: (v) => multiValueHandler(v, i),
          disabled,
          value: valueAsArray[i] ?? getFirstOption(values),
          options: values,
          listsAsArrays
        });
      });
      return /* @__PURE__ */ createElement("span", {
        "data-testid": testID,
        className,
        title
      }, editors[0], separator, editors[1]);
    }
    switch (type) {
      case "select":
      case "multiselect":
        return /* @__PURE__ */ createElement(SelectorComponent, {
          ...propsForValueSelector,
          schema: allProps.schema,
          testID,
          className,
          title,
          handleOnChange,
          disabled,
          value,
          options: values,
          multiple: type === "multiselect",
          listsAsArrays
        });
      case "textarea":
        return /* @__PURE__ */ createElement("textarea", {
          "data-testid": testID,
          placeholder: placeHolderText,
          value,
          title,
          className,
          disabled,
          onChange: (e) => handleOnChange(e.target.value)
        });
      case "switch":
      case "checkbox":
        return /* @__PURE__ */ createElement("input", {
          "data-testid": testID,
          type: "checkbox",
          className,
          title,
          onChange: (e) => handleOnChange(e.target.checked),
          checked: !!value,
          disabled
        });
      case "radio":
        return /* @__PURE__ */ createElement("span", {
          "data-testid": testID,
          className,
          title
        }, values.map((v) => /* @__PURE__ */ createElement(RadioButton, {
          key: v.name,
          name: v.name,
          disabled,
          checked: value === v.name,
          handleOnChange,
          label: v.label
        })));
    }
    if (inputType === "bigint") return /* @__PURE__ */ createElement("input", {
      "data-testid": testID,
      type: inputTypeCoerced,
      placeholder: placeHolderText,
      value: `${value}`,
      title,
      className,
      disabled,
      onChange: (e) => bigIntValueHandler(e.target.value)
    });
    return /* @__PURE__ */ createElement("input", {
      "data-testid": testID,
      type: inputTypeCoerced,
      placeholder: placeHolderText,
      value,
      title,
      className,
      disabled,
      onChange: (e) => handleOnChange(parseNumber(e.target.value, { parseNumbers: parseNumberMethod }))
    });
  };
  var useValueEditor = (props) => {
    const { handleOnChange, inputType, operator, value, listsAsArrays, parseNumbers, values, type, skipHook, schema: { classNames: classNamesProp, suppressStandardClassnames } } = props;
    useEffect(() => {
      if (!skipHook && type !== "multiselect" && ![
        "between",
        "notBetween",
        "in",
        "notIn"
      ].includes(operator) && (Array.isArray(value) || inputType === "number" && typeof value === "string" && value.includes(","))) handleOnChange(toArray(value, { retainEmptyStrings: true })[0] ?? "");
    }, [
      handleOnChange,
      inputType,
      operator,
      skipHook,
      type,
      value
    ]);
    const valueAsArray = useMemo(() => toArray(value, { retainEmptyStrings: true }), [value]);
    const parseNumberMethod = useMemo(() => getParseNumberMethod({
      parseNumbers,
      inputType
    }), [inputType, parseNumbers]);
    return {
      valueAsArray,
      multiValueHandler: useCallback((val, idx) => {
        const parsedVal = parseNumber(val, { parseNumbers: parseNumberMethod });
        const needsBetweenFix = idx === 0 && (operator === "between" || operator === "notBetween") && (valueAsArray.length < 2 || valueAsArray[1] === void 0);
        if (valueAsArray[idx] === parsedVal && !needsBetweenFix) {
          handleOnChange(listsAsArrays ? valueAsArray : joinWith(valueAsArray, ","));
          return;
        }
        const v = [...valueAsArray];
        v[idx] = parsedVal;
        if (needsBetweenFix) v[1] = getFirstOption(values);
        handleOnChange(listsAsArrays ? v : joinWith(v, ","));
      }, [
        handleOnChange,
        listsAsArrays,
        operator,
        parseNumberMethod,
        valueAsArray,
        values
      ]),
      bigIntValueHandler: useCallback((v) => {
        const valAsMaybeNumber = parseNumber(v, {
          parseNumbers: parseNumberMethod,
          bigIntOnOverflow: true
        });
        let bi;
        try {
          bi = BigInt(valAsMaybeNumber);
        } catch {
          handleOnChange(valAsMaybeNumber);
          return;
        }
        handleOnChange(bi);
      }, [handleOnChange, parseNumberMethod]),
      parseNumberMethod,
      valueListItemClassName: clsx(suppressStandardClassnames || standardClassnames.valueListItem, classNamesProp?.valueListItem),
      inputTypeCoerced: inputType === "bigint" || operator === "in" || operator === "notIn" ? "text" : inputType || "text"
    };
  };
  var useSelectElementChangeHandler = (params) => {
    const { multiple, onChange } = params;
    return useMemo(() => multiple ? (e) => onChange(Array.from(e.target.selectedOptions).map((o) => o.value)) : (e) => onChange(e.target.value), [multiple, onChange]);
  };
  var toOptions = (arr) => isOptionGroupArray(arr) ? arr.map((og) => /* @__PURE__ */ createElement("optgroup", {
    key: og.label,
    label: og.label
  }, og.options.map((opt) => /* @__PURE__ */ createElement("option", {
    key: opt.name,
    value: opt.name,
    disabled: opt.disabled
  }, opt.label)))) : Array.isArray(arr) ? arr.map((opt) => /* @__PURE__ */ createElement("option", {
    key: opt.name,
    value: opt.name,
    disabled: opt.disabled
  }, opt.label)) : null;
  var ValueSelector = (props) => {
    const { onChange, val } = useValueSelector(props);
    const selectElementChangeHandler = useSelectElementChangeHandler({
      multiple: props.multiple,
      onChange
    });
    return /* @__PURE__ */ createElement("select", {
      "data-testid": props.testID,
      className: props.className,
      value: val,
      title: props.title,
      disabled: props.disabled,
      multiple: !!props.multiple,
      onChange: selectElementChangeHandler
    }, toOptions(props.options));
  };
  var useValueSelector = (props) => {
    const { handleOnChange, listsAsArrays = false, multiple = false, value } = props;
    return {
      onChange: useCallback((v) => {
        if (multiple) {
          const valueAsArray = toArray(v);
          handleOnChange(listsAsArrays ? valueAsArray : joinWith(valueAsArray, ","));
        } else handleOnChange(v);
      }, [
        handleOnChange,
        listsAsArrays,
        multiple
      ]),
      val: useMemo(() => multiple ? toArray(value).map(String) : value, [multiple, value])
    };
  };
  var QueryBuilderInternal = ({ props }) => {
    const qb = useQueryBuilder(props);
    const RuleGroupControlElement = qb.schema.controls.ruleGroup;
    const QueryBuilderContext$1 = QueryBuilderContext;
    return /* @__PURE__ */ createElement(QueryBuilderContext$1.Provider, {
      key: qb.dndEnabledAttr,
      value: qb.rqbContext
    }, /* @__PURE__ */ createElement("div", {
      role: "form",
      className: qb.wrapperClassName,
      "data-dnd": qb.dndEnabledAttr,
      "data-inlinecombinators": qb.inlineCombinatorsAttr
    }, /* @__PURE__ */ createElement(RuleGroupControlElement, {
      translations: qb.translations,
      ruleGroup: qb.rootGroup,
      rules: qb.rootGroup.rules,
      ...qb.combinatorPropObject,
      not: !!qb.rootGroup.not,
      schema: qb.schema,
      actions: qb.actions,
      id: qb.rootGroup.id,
      path: rootPath,
      disabled: qb.rootGroupDisabled,
      shiftUpDisabled: true,
      shiftDownDisabled: true,
      parentDisabled: qb.queryDisabled,
      context: props.context
    })));
  };
  var nullComp = () => null;
  var nullFwdComp = forwardRef(nullComp);
  var emptyObject2 = {};
  var useMergedContext = ({ finalize: finalize2, ...props }) => {
    const rqbContext = useContext(QueryBuilderContext);
    const queryBuilderFlags = useMemo(() => preferFlagProps(props, rqbContext, finalize2), [
      props,
      rqbContext,
      finalize2
    ]);
    const enableDragAndDrop = finalize2 ? rqbContext.enableDragAndDrop !== false && preferProp(false, props.enableDragAndDrop, rqbContext.enableDragAndDrop) : props.enableDragAndDrop ?? rqbContext.enableDragAndDrop;
    const cc = useMemo(() => mergeClassnames(finalize2 ? Object.assign({}, defaultControlClassnames) : emptyObject2, rqbContext.controlClassnames, props.controlClassnames), [
      rqbContext.controlClassnames,
      props.controlClassnames,
      finalize2
    ]);
    const controlClassnames = useMemo(() => ({
      actionElement: cc.actionElement,
      addGroup: cc.addGroup,
      addRule: cc.addRule,
      body: cc.body,
      cloneGroup: cc.cloneGroup,
      cloneRule: cc.cloneRule,
      combinators: cc.combinators,
      dragHandle: cc.dragHandle,
      fields: cc.fields,
      header: cc.header,
      lockGroup: cc.lockGroup,
      lockRule: cc.lockRule,
      muteGroup: cc.muteGroup,
      muteRule: cc.muteRule,
      muted: cc.muted,
      notToggle: cc.notToggle,
      operators: cc.operators,
      queryBuilder: cc.queryBuilder,
      removeGroup: cc.removeGroup,
      removeRule: cc.removeRule,
      rule: cc.rule,
      ruleGroup: cc.ruleGroup,
      shiftActions: cc.shiftActions,
      value: cc.value,
      valueSelector: cc.valueSelector,
      valueSource: cc.valueSource,
      betweenRules: cc.betweenRules,
      valid: cc.valid,
      invalid: cc.invalid,
      dndDragging: cc.dndDragging,
      dndOver: cc.dndOver,
      dndCopy: cc.dndCopy,
      dndGroup: cc.dndGroup,
      dndDropNotAllowed: cc.dndDropNotAllowed,
      dndPreviewPosition: cc.dndPreviewPosition,
      dndHidden: cc.dndHidden,
      disabled: cc.disabled,
      valueListItem: cc.valueListItem,
      matchMode: cc.matchMode,
      matchThreshold: cc.matchThreshold,
      branches: cc.branches,
      hasSubQuery: cc.hasSubQuery,
      loading: cc.loading
    }), [
      cc.actionElement,
      cc.addGroup,
      cc.addRule,
      cc.betweenRules,
      cc.body,
      cc.branches,
      cc.cloneGroup,
      cc.cloneRule,
      cc.combinators,
      cc.disabled,
      cc.dndCopy,
      cc.dndDropNotAllowed,
      cc.dndPreviewPosition,
      cc.dndHidden,
      cc.dndGroup,
      cc.dndDragging,
      cc.dndOver,
      cc.dragHandle,
      cc.fields,
      cc.hasSubQuery,
      cc.header,
      cc.invalid,
      cc.loading,
      cc.lockGroup,
      cc.lockRule,
      cc.muteGroup,
      cc.muteRule,
      cc.muted,
      cc.matchMode,
      cc.matchThreshold,
      cc.notToggle,
      cc.operators,
      cc.queryBuilder,
      cc.removeGroup,
      cc.removeRule,
      cc.rule,
      cc.ruleGroup,
      cc.shiftActions,
      cc.valid,
      cc.value,
      cc.valueListItem,
      cc.valueSelector,
      cc.valueSource
    ]);
    const contextCE = rqbContext.controlElements ?? emptyObject2;
    const propsCE = props.controlElements ?? emptyObject2;
    const mergeControlElement = useCallback((name, propComp, contextComp) => {
      const nc = name === "dragHandle" ? nullFwdComp : nullComp;
      const propBulkOverride = (name.endsWith("Action") && propsCE.actionElement ? propsCE.actionElement : void 0) ?? (name.endsWith("Selector") && propsCE.valueSelector ? propsCE.valueSelector : void 0);
      const contextBulkOverride = (name.endsWith("Action") && contextCE.actionElement ? contextCE.actionElement : void 0) ?? (name.endsWith("Selector") && contextCE.valueSelector ? contextCE.valueSelector : void 0);
      const comp = propComp === null ? nc : propComp ?? (finalize2 ? propBulkOverride : void 0) ?? (contextComp === null ? nc : contextComp ?? (finalize2 ? contextBulkOverride : void 0));
      return comp ? { [name]: comp } : finalize2 ? { [name]: defaultControlElements[name] } : emptyObject2;
    }, [
      contextCE.actionElement,
      contextCE.valueSelector,
      finalize2,
      propsCE.actionElement,
      propsCE.valueSelector
    ]);
    const controlElements = useMemo(() => Object.assign({}, mergeControlElement("addGroupAction", propsCE.addGroupAction, contextCE.addGroupAction), mergeControlElement("addRuleAction", propsCE.addRuleAction, contextCE.addRuleAction), mergeControlElement("cloneGroupAction", propsCE.cloneGroupAction, contextCE.cloneGroupAction), mergeControlElement("cloneRuleAction", propsCE.cloneRuleAction, contextCE.cloneRuleAction), mergeControlElement("combinatorSelector", propsCE.combinatorSelector, contextCE.combinatorSelector), mergeControlElement("dragHandle", propsCE.dragHandle, contextCE.dragHandle), mergeControlElement("fieldSelector", propsCE.fieldSelector, contextCE.fieldSelector), mergeControlElement("inlineCombinator", propsCE.inlineCombinator, contextCE.inlineCombinator), mergeControlElement("lockGroupAction", propsCE.lockGroupAction, contextCE.lockGroupAction), mergeControlElement("lockRuleAction", propsCE.lockRuleAction, contextCE.lockRuleAction), mergeControlElement("muteGroupAction", propsCE.muteGroupAction, contextCE.muteGroupAction), mergeControlElement("muteRuleAction", propsCE.muteRuleAction, contextCE.muteRuleAction), mergeControlElement("notToggle", propsCE.notToggle, contextCE.notToggle), mergeControlElement("operatorSelector", propsCE.operatorSelector, contextCE.operatorSelector), mergeControlElement("removeGroupAction", propsCE.removeGroupAction, contextCE.removeGroupAction), mergeControlElement("removeRuleAction", propsCE.removeRuleAction, contextCE.removeRuleAction), mergeControlElement("shiftActions", propsCE.shiftActions, contextCE.shiftActions), { valueEditor: propsCE.valueEditor === null ? nullComp : propsCE.valueEditor ?? (contextCE.valueEditor === null ? nullComp : contextCE.valueEditor) ?? defaultControlElements.valueEditor }, mergeControlElement("valueSourceSelector", propsCE.valueSourceSelector, contextCE.valueSourceSelector), mergeControlElement("matchModeEditor", propsCE.matchModeEditor, contextCE.matchModeEditor), mergeControlElement("rule", propsCE.rule, contextCE.rule), mergeControlElement("ruleGroup", propsCE.ruleGroup, contextCE.ruleGroup), mergeControlElement("ruleGroupBodyElements", propsCE.ruleGroupBodyElements, contextCE.ruleGroupBodyElements), mergeControlElement("ruleGroupHeaderElements", propsCE.ruleGroupHeaderElements, contextCE.ruleGroupHeaderElements), { actionElement: propsCE.actionElement ?? contextCE.actionElement ?? (finalize2 ? defaultControlElements.actionElement : void 0) }, { valueSelector: propsCE.valueSelector ?? contextCE.valueSelector ?? (finalize2 ? defaultControlElements.valueSelector : void 0) }), [
      contextCE.actionElement,
      contextCE.addGroupAction,
      contextCE.addRuleAction,
      contextCE.cloneGroupAction,
      contextCE.cloneRuleAction,
      contextCE.combinatorSelector,
      contextCE.dragHandle,
      contextCE.fieldSelector,
      contextCE.inlineCombinator,
      contextCE.lockGroupAction,
      contextCE.lockRuleAction,
      contextCE.muteGroupAction,
      contextCE.muteRuleAction,
      contextCE.matchModeEditor,
      contextCE.notToggle,
      contextCE.operatorSelector,
      contextCE.removeGroupAction,
      contextCE.removeRuleAction,
      contextCE.rule,
      contextCE.ruleGroup,
      contextCE.ruleGroupBodyElements,
      contextCE.ruleGroupHeaderElements,
      contextCE.shiftActions,
      contextCE.valueEditor,
      contextCE.valueSelector,
      contextCE.valueSourceSelector,
      mergeControlElement,
      finalize2,
      propsCE.actionElement,
      propsCE.addGroupAction,
      propsCE.addRuleAction,
      propsCE.cloneGroupAction,
      propsCE.cloneRuleAction,
      propsCE.combinatorSelector,
      propsCE.dragHandle,
      propsCE.fieldSelector,
      propsCE.inlineCombinator,
      propsCE.lockGroupAction,
      propsCE.lockRuleAction,
      propsCE.muteGroupAction,
      propsCE.muteRuleAction,
      propsCE.matchModeEditor,
      propsCE.notToggle,
      propsCE.operatorSelector,
      propsCE.removeGroupAction,
      propsCE.removeRuleAction,
      propsCE.rule,
      propsCE.ruleGroup,
      propsCE.ruleGroupBodyElements,
      propsCE.ruleGroupHeaderElements,
      propsCE.shiftActions,
      propsCE.valueEditor,
      propsCE.valueSelector,
      propsCE.valueSourceSelector
    ]);
    const propsT = props.translations ?? emptyObject2;
    const contextT = rqbContext.translations ?? emptyObject2;
    const translations = useMemo(() => Object.assign({}, mergeAnyTranslation("addGroup", {
      label: [propsT.addGroup?.label, contextT.addGroup?.label],
      title: [propsT.addGroup?.title, contextT.addGroup?.title]
    }, finalize2 ? defaultTranslations : void 0), mergeAnyTranslation("addRule", {
      label: [propsT.addRule?.label, contextT.addRule?.label],
      title: [propsT.addRule?.title, contextT.addRule?.title]
    }, finalize2 ? defaultTranslations : void 0), mergeAnyTranslation("cloneRule", {
      label: [propsT.cloneRule?.label, contextT.cloneRule?.label],
      title: [propsT.cloneRule?.title, contextT.cloneRule?.title]
    }, finalize2 ? defaultTranslations : void 0), mergeAnyTranslation("cloneRuleGroup", {
      label: [propsT.cloneRuleGroup?.label, contextT.cloneRuleGroup?.label],
      title: [propsT.cloneRuleGroup?.title, contextT.cloneRuleGroup?.title]
    }, finalize2 ? defaultTranslations : void 0), mergeAnyTranslation("combinators", { title: [propsT.combinators?.title, contextT.combinators?.title] }, finalize2 ? defaultTranslations : void 0), mergeAnyTranslation("dragHandle", {
      label: [propsT.dragHandle?.label, contextT.dragHandle?.label],
      title: [propsT.dragHandle?.title, contextT.dragHandle?.title]
    }, finalize2 ? defaultTranslations : void 0), mergeAnyTranslation("fields", {
      placeholderGroupLabel: [propsT.fields?.placeholderGroupLabel, contextT.fields?.placeholderGroupLabel],
      placeholderLabel: [propsT.fields?.placeholderLabel, contextT.fields?.placeholderLabel],
      placeholderName: [propsT.fields?.placeholderName, contextT.fields?.placeholderName],
      title: [propsT.fields?.title, contextT.fields?.title]
    }, finalize2 ? defaultTranslations : void 0), mergeAnyTranslation("lockGroup", {
      label: [propsT.lockGroup?.label, contextT.lockGroup?.label],
      title: [propsT.lockGroup?.title, contextT.lockGroup?.title]
    }, finalize2 ? defaultTranslations : void 0), mergeAnyTranslation("lockGroupDisabled", {
      label: [propsT.lockGroupDisabled?.label, contextT.lockGroupDisabled?.label],
      title: [propsT.lockGroupDisabled?.title, contextT.lockGroupDisabled?.title]
    }, finalize2 ? defaultTranslations : void 0), mergeAnyTranslation("lockRule", {
      label: [propsT.lockRule?.label, contextT.lockRule?.label],
      title: [propsT.lockRule?.title, contextT.lockRule?.title]
    }, finalize2 ? defaultTranslations : void 0), mergeAnyTranslation("lockRuleDisabled", {
      label: [propsT.lockRuleDisabled?.label, contextT.lockRuleDisabled?.label],
      title: [propsT.lockRuleDisabled?.title, contextT.lockRuleDisabled?.title]
    }, finalize2 ? defaultTranslations : void 0), mergeAnyTranslation("muteGroup", {
      label: [propsT.muteGroup?.label, contextT.muteGroup?.label],
      title: [propsT.muteGroup?.title, contextT.muteGroup?.title]
    }, finalize2 ? defaultTranslations : void 0), mergeAnyTranslation("unmuteGroup", {
      label: [propsT.unmuteGroup?.label, contextT.unmuteGroup?.label],
      title: [propsT.unmuteGroup?.title, contextT.unmuteGroup?.title]
    }, finalize2 ? defaultTranslations : void 0), mergeAnyTranslation("muteRule", {
      label: [propsT.muteRule?.label, contextT.muteRule?.label],
      title: [propsT.muteRule?.title, contextT.muteRule?.title]
    }, finalize2 ? defaultTranslations : void 0), mergeAnyTranslation("unmuteRule", {
      label: [propsT.unmuteRule?.label, contextT.unmuteRule?.label],
      title: [propsT.unmuteRule?.title, contextT.unmuteRule?.title]
    }, finalize2 ? defaultTranslations : void 0), mergeAnyTranslation("notToggle", {
      label: [propsT.notToggle?.label, contextT.notToggle?.label],
      title: [propsT.notToggle?.title, contextT.notToggle?.title]
    }, finalize2 ? defaultTranslations : void 0), mergeAnyTranslation("operators", {
      placeholderGroupLabel: [propsT.operators?.placeholderGroupLabel, contextT.operators?.placeholderGroupLabel],
      placeholderLabel: [propsT.operators?.placeholderLabel, contextT.operators?.placeholderLabel],
      placeholderName: [propsT.operators?.placeholderName, contextT.operators?.placeholderName],
      title: [propsT.operators?.title, contextT.operators?.title]
    }, finalize2 ? defaultTranslations : void 0), mergeAnyTranslation("values", {
      placeholderGroupLabel: [propsT.values?.placeholderGroupLabel, contextT.values?.placeholderGroupLabel],
      placeholderLabel: [propsT.values?.placeholderLabel, contextT.values?.placeholderLabel],
      placeholderName: [propsT.values?.placeholderName, contextT.values?.placeholderName],
      title: [propsT.values?.title, contextT.values?.title]
    }, finalize2 ? defaultTranslations : void 0), mergeAnyTranslation("removeGroup", {
      label: [propsT.removeGroup?.label, contextT.removeGroup?.label],
      title: [propsT.removeGroup?.title, contextT.removeGroup?.title]
    }, finalize2 ? defaultTranslations : void 0), mergeAnyTranslation("removeRule", {
      label: [propsT.removeRule?.label, contextT.removeRule?.label],
      title: [propsT.removeRule?.title, contextT.removeRule?.title]
    }, finalize2 ? defaultTranslations : void 0), mergeAnyTranslation("shiftActionDown", {
      label: [propsT.shiftActionDown?.label, contextT.shiftActionDown?.label],
      title: [propsT.shiftActionDown?.title, contextT.shiftActionDown?.title]
    }, finalize2 ? defaultTranslations : void 0), mergeAnyTranslation("shiftActionUp", {
      label: [propsT.shiftActionUp?.label, contextT.shiftActionUp?.label],
      title: [propsT.shiftActionUp?.title, contextT.shiftActionUp?.title]
    }, finalize2 ? defaultTranslations : void 0), mergeAnyTranslation("matchMode", { title: [propsT.matchMode?.title, contextT.matchMode?.title] }, finalize2 ? defaultTranslations : void 0), mergeAnyTranslation("matchThreshold", {
      title: [propsT.matchThreshold?.title, contextT.matchThreshold?.title],
      placeholderName: [propsT.matchThreshold?.placeholderName, contextT.matchThreshold?.placeholderName]
    }, finalize2 ? defaultTranslations : void 0), mergeAnyTranslation("value", { title: [propsT.value?.title, contextT.value?.title] }, finalize2 ? defaultTranslations : void 0), mergeAnyTranslation("valueSourceSelector", { title: [propsT.valueSourceSelector?.title, contextT.valueSourceSelector?.title] }, finalize2 ? defaultTranslations : void 0)), [
      contextT.addGroup?.label,
      contextT.addGroup?.title,
      contextT.addRule?.label,
      contextT.addRule?.title,
      contextT.cloneRule?.label,
      contextT.cloneRule?.title,
      contextT.cloneRuleGroup?.label,
      contextT.cloneRuleGroup?.title,
      contextT.combinators?.title,
      contextT.dragHandle?.label,
      contextT.dragHandle?.title,
      contextT.fields?.placeholderGroupLabel,
      contextT.fields?.placeholderLabel,
      contextT.fields?.placeholderName,
      contextT.fields?.title,
      contextT.lockGroup?.label,
      contextT.lockGroup?.title,
      contextT.lockGroupDisabled?.label,
      contextT.lockGroupDisabled?.title,
      contextT.lockRule?.label,
      contextT.lockRule?.title,
      contextT.lockRuleDisabled?.label,
      contextT.lockRuleDisabled?.title,
      contextT.muteGroup?.label,
      contextT.muteGroup?.title,
      contextT.unmuteGroup?.label,
      contextT.unmuteGroup?.title,
      contextT.muteRule?.label,
      contextT.muteRule?.title,
      contextT.unmuteRule?.label,
      contextT.unmuteRule?.title,
      contextT.matchMode?.title,
      contextT.matchThreshold?.title,
      contextT.matchThreshold?.placeholderName,
      contextT.notToggle?.label,
      contextT.notToggle?.title,
      contextT.operators?.placeholderGroupLabel,
      contextT.operators?.placeholderLabel,
      contextT.operators?.placeholderName,
      contextT.operators?.title,
      contextT.removeGroup?.label,
      contextT.removeGroup?.title,
      contextT.removeRule?.label,
      contextT.removeRule?.title,
      contextT.shiftActionDown?.label,
      contextT.shiftActionDown?.title,
      contextT.shiftActionUp?.label,
      contextT.shiftActionUp?.title,
      contextT.value?.title,
      contextT.values?.placeholderGroupLabel,
      contextT.values?.placeholderLabel,
      contextT.values?.placeholderName,
      contextT.values?.title,
      contextT.valueSourceSelector?.title,
      finalize2,
      propsT.addGroup?.label,
      propsT.addGroup?.title,
      propsT.addRule?.label,
      propsT.addRule?.title,
      propsT.cloneRule?.label,
      propsT.cloneRule?.title,
      propsT.cloneRuleGroup?.label,
      propsT.cloneRuleGroup?.title,
      propsT.combinators?.title,
      propsT.dragHandle?.label,
      propsT.dragHandle?.title,
      propsT.fields?.placeholderGroupLabel,
      propsT.fields?.placeholderLabel,
      propsT.fields?.placeholderName,
      propsT.fields?.title,
      propsT.lockGroup?.label,
      propsT.lockGroup?.title,
      propsT.lockGroupDisabled?.label,
      propsT.lockGroupDisabled?.title,
      propsT.lockRule?.label,
      propsT.lockRule?.title,
      propsT.lockRuleDisabled?.label,
      propsT.lockRuleDisabled?.title,
      propsT.muteGroup?.label,
      propsT.muteGroup?.title,
      propsT.unmuteGroup?.label,
      propsT.unmuteGroup?.title,
      propsT.muteRule?.label,
      propsT.muteRule?.title,
      propsT.unmuteRule?.label,
      propsT.unmuteRule?.title,
      propsT.matchMode?.title,
      propsT.matchThreshold?.title,
      propsT.matchThreshold?.placeholderName,
      propsT.notToggle?.label,
      propsT.notToggle?.title,
      propsT.operators?.placeholderGroupLabel,
      propsT.operators?.placeholderLabel,
      propsT.operators?.placeholderName,
      propsT.operators?.title,
      propsT.removeGroup?.label,
      propsT.removeGroup?.title,
      propsT.removeRule?.label,
      propsT.removeRule?.title,
      propsT.shiftActionDown?.label,
      propsT.shiftActionDown?.title,
      propsT.shiftActionUp?.label,
      propsT.shiftActionUp?.title,
      propsT.value?.title,
      propsT.values?.placeholderGroupLabel,
      propsT.values?.placeholderLabel,
      propsT.values?.placeholderName,
      propsT.values?.title,
      propsT.valueSourceSelector?.title
    ]);
    return {
      ...queryBuilderFlags,
      controlClassnames,
      controlElements,
      enableDragAndDrop,
      translations,
      initialQuery: props.initialQuery,
      qbId: props.qbId
    };
  };
  var usePathsMemo = ({ disabled, path, nestedArray, disabledPaths }) => {
    const nestedArrayLength = nestedArray.length;
    return useMemo(() => {
      const paths = [];
      for (let i = 0; i < nestedArrayLength; i++) {
        const thisPath = [...path, i];
        paths[i] = {
          path: thisPath,
          disabled: disabled || disabledPaths.some((p) => pathsAreEqual(thisPath, p))
        };
      }
      return paths;
    }, [
      disabled,
      path,
      nestedArrayLength,
      disabledPaths
    ]);
  };
  var useReactDndWarning = (enableDragAndDrop, dndRefs) => {
    if (false) {
      console.error(messages.errorEnabledDndWithoutReactDnD);
      didWarnEnabledDndWithoutReactDnD = true;
    }
  };
  var useStopEventPropagation = (method) => useCallback((event, context) => {
    event?.preventDefault();
    event?.stopPropagation();
    method(event, context);
  }, [method]);
  var defaultMatch = { mode: "all" };
  var defaultSubproperties = [{
    name: "",
    value: "",
    label: ""
  }];
  var Rule = memo(function Rule2(props) {
    const r = useRule(props);
    const cloneRule = useStopEventPropagation(r.cloneRule);
    const toggleLockRule = useStopEventPropagation(r.toggleLockRule);
    const toggleMuteRule = useStopEventPropagation(r.toggleMuteRule);
    const removeRule = useStopEventPropagation(r.removeRule);
    const shiftRuleUp = useStopEventPropagation(r.shiftRuleUp);
    const shiftRuleDown = useStopEventPropagation(r.shiftRuleDown);
    const actions = useMemo(() => ({
      cloneRule,
      toggleLockRule,
      toggleMuteRule,
      removeRule,
      shiftRuleUp,
      shiftRuleDown
    }), [
      cloneRule,
      removeRule,
      shiftRuleDown,
      shiftRuleUp,
      toggleLockRule,
      toggleMuteRule
    ]);
    return /* @__PURE__ */ createElement("div", {
      ref: r.dndRef,
      "data-testid": TestID.rule,
      "data-dragmonitorid": r.dragMonitorId,
      "data-dropmonitorid": r.dropMonitorId,
      className: r.outerClassName,
      "data-rule-id": r.id,
      "data-level": r.path.length,
      "data-path": JSON.stringify(r.path)
    }, r.matchModes.length > 0 ? /* @__PURE__ */ createElement(RuleComponentsWithSubQuery, {
      ...r,
      ...actions
    }) : /* @__PURE__ */ createElement(RuleComponents, {
      ...r,
      ...actions
    }));
  });
  var RuleComponents = memo(function RuleComponents2(r) {
    const { schema: { controls: { shiftActions: ShiftActionsControlElement, dragHandle: DragHandleControlElement, fieldSelector: FieldSelectorControlElement, matchModeEditor: MatchModeEditorControlElement, operatorSelector: OperatorSelectorControlElement, valueSourceSelector: ValueSourceSelectorControlElement, valueEditor: ValueEditorControlElement, cloneRuleAction: CloneRuleActionControlElement, lockRuleAction: LockRuleActionControlElement, muteRuleAction: MuteRuleActionControlElement, removeRuleAction: RemoveRuleActionControlElement, ruleGroupBodyElements: RuleGroupBodyControlElements, ruleGroupHeaderElements: RuleGroupHeaderControlElements } }, groupComponentsWrapper: GroupComponentsWrapper = Fragment } = r;
    const commonSubcomponentProps = useMemo(() => ({
      level: r.path.length,
      path: r.path,
      disabled: r.disabled,
      context: r.context,
      validation: r.validationResult,
      schema: r.schema,
      rule: r.rule
    }), [
      r.path,
      r.disabled,
      r.context,
      r.validationResult,
      r.schema,
      r.rule
    ]);
    const showFieldSelector = useMemo(() => !(r.schema.fields.length === 1 && isPojo(r.schema.fields[0]) && "value" in r.schema.fields[0] && r.schema.fields[0].value === ""), [r.schema.fields]);
    const shiftTitles = useMemo(() => r.schema.showShiftActions ? {
      shiftUp: r.translations.shiftActionUp.title,
      shiftDown: r.translations.shiftActionDown.title
    } : void 0, [r.schema.showShiftActions, r.translations]);
    const shiftLabels = useMemo(() => r.schema.showShiftActions ? {
      shiftUp: r.translations.shiftActionUp.label,
      shiftDown: r.translations.shiftActionDown.label
    } : void 0, [r.schema.showShiftActions, r.translations]);
    return /* @__PURE__ */ createElement(Fragment, null, r.schema.showShiftActions && /* @__PURE__ */ createElement(ShiftActionsControlElement, {
      key: TestID.shiftActions,
      ...commonSubcomponentProps,
      testID: TestID.shiftActions,
      titles: shiftTitles,
      labels: shiftLabels,
      className: r.classNames.shiftActions,
      ruleOrGroup: r.rule,
      shiftUp: r.shiftRuleUp,
      shiftDown: r.shiftRuleDown,
      shiftUpDisabled: r.shiftUpDisabled,
      shiftDownDisabled: r.shiftDownDisabled
    }), r.schema.enableDragAndDrop && /* @__PURE__ */ createElement(DragHandleControlElement, {
      key: TestID.dragHandle,
      ...commonSubcomponentProps,
      testID: TestID.dragHandle,
      ref: r.dragRef,
      title: r.translations.dragHandle.title,
      label: r.translations.dragHandle.label,
      className: r.classNames.dragHandle,
      ruleOrGroup: r.rule
    }), showFieldSelector && /* @__PURE__ */ createElement(FieldSelectorControlElement, {
      key: TestID.fields,
      ...commonSubcomponentProps,
      testID: TestID.fields,
      options: r.schema.fields,
      title: r.translations.fields.title,
      value: r.rule.field,
      operator: r.rule.operator,
      className: r.classNames.fields,
      handleOnChange: r.onChangeField
    }), (r.schema.autoSelectField || r.rule.field !== r.translations.fields.placeholderName) && (r.subQuery ? /* @__PURE__ */ createElement(MatchModeEditorControlElement, {
      key: TestID.matchModeEditor,
      ...commonSubcomponentProps,
      testID: TestID.matchModeEditor,
      field: r.rule.field,
      fieldData: r.fieldData,
      title: r.translations.matchMode.title,
      options: r.matchModes,
      thresholdPlaceholder: r.translations.matchThreshold.placeholderName,
      match: r.rule.match ?? defaultMatch,
      className: r.classNames.matchMode,
      classNames: r.classNames,
      handleOnChange: r.onChangeMatchMode
    }) : /* @__PURE__ */ createElement(Fragment, null, /* @__PURE__ */ createElement(OperatorSelectorControlElement, {
      key: TestID.operators,
      ...commonSubcomponentProps,
      testID: TestID.operators,
      field: r.rule.field,
      fieldData: r.fieldData,
      title: r.translations.operators.title,
      options: r.operators,
      value: r.rule.operator,
      className: r.classNames.operators,
      handleOnChange: r.onChangeOperator
    }), (r.schema.autoSelectOperator || r.rule.operator !== r.translations.operators.placeholderName) && !r.hideValueControls && /* @__PURE__ */ createElement(Fragment, null, !["null", "notnull"].includes(lc(`${r.rule.operator}`)) && r.valueSources.length > 1 && /* @__PURE__ */ createElement(ValueSourceSelectorControlElement, {
      key: TestID.valueSourceSelector,
      ...commonSubcomponentProps,
      testID: TestID.valueSourceSelector,
      field: r.rule.field,
      fieldData: r.fieldData,
      title: r.translations.valueSourceSelector.title,
      options: r.valueSourceOptions,
      value: r.rule.valueSource ?? "value",
      className: r.classNames.valueSource,
      handleOnChange: r.onChangeValueSource
    }), /* @__PURE__ */ createElement(ValueEditorControlElement, {
      key: TestID.valueEditor,
      ...commonSubcomponentProps,
      testID: TestID.valueEditor,
      field: r.rule.field,
      fieldData: r.fieldData,
      title: r.translations.value.title,
      operator: r.rule.operator,
      value: r.rule.value,
      valueSource: r.rule.valueSource ?? "value",
      type: r.valueEditorType,
      inputType: r.inputType,
      values: r.values,
      listsAsArrays: r.schema.listsAsArrays,
      parseNumbers: r.schema.parseNumbers,
      separator: r.valueEditorSeparator,
      className: r.classNames.value,
      handleOnChange: r.onChangeValue
    })))), r.subQuery && /* @__PURE__ */ createElement(GroupComponentsWrapper, { className: r.subQuery.classNames.header }, /* @__PURE__ */ createElement(RuleGroupHeaderControlElements, r.subQuery)), r.schema.showCloneButtons && /* @__PURE__ */ createElement(CloneRuleActionControlElement, {
      key: TestID.cloneRule,
      ...commonSubcomponentProps,
      testID: TestID.cloneRule,
      label: r.translations.cloneRule.label,
      title: r.translations.cloneRule.title,
      className: r.classNames.cloneRule,
      ruleOrGroup: r.rule,
      handleOnClick: r.cloneRule
    }), r.schema.showLockButtons && /* @__PURE__ */ createElement(LockRuleActionControlElement, {
      key: TestID.lockRule,
      ...commonSubcomponentProps,
      testID: TestID.lockRule,
      label: r.translations.lockRule.label,
      title: r.translations.lockRule.title,
      className: r.classNames.lockRule,
      ruleOrGroup: r.rule,
      handleOnClick: r.toggleLockRule,
      disabledTranslation: r.parentDisabled ? void 0 : r.translations.lockRuleDisabled
    }), r.schema.showMuteButtons && /* @__PURE__ */ createElement(MuteRuleActionControlElement, {
      key: TestID.muteRule,
      ...commonSubcomponentProps,
      testID: TestID.muteRule,
      label: r.rule.muted ? r.translations.unmuteRule.label : r.translations.muteRule.label,
      title: r.rule.muted ? r.translations.unmuteRule.title : r.translations.muteRule.title,
      className: r.classNames.muteRule,
      ruleOrGroup: r.rule,
      handleOnClick: r.toggleMuteRule
    }), /* @__PURE__ */ createElement(RemoveRuleActionControlElement, {
      key: TestID.removeRule,
      ...commonSubcomponentProps,
      testID: TestID.removeRule,
      label: r.translations.removeRule.label,
      title: r.translations.removeRule.title,
      className: r.classNames.removeRule,
      ruleOrGroup: r.rule,
      handleOnClick: r.removeRule
    }), r.subQuery && /* @__PURE__ */ createElement(GroupComponentsWrapper, { className: r.subQuery.classNames.body }, /* @__PURE__ */ createElement(RuleGroupBodyControlElements, r.subQuery)));
  });
  var RuleWithSubQueryGroupComponentsWrapper = (props) => /* @__PURE__ */ createElement("div", props);
  var RuleComponentsWithSubQuery = memo(function RuleComponentsWithSubQuery2(r) {
    const initialQuery = useMemo(() => r.schema.createRuleGroup(), [r.schema]);
    const subQB = useQueryBuilder({
      ...r.subQueryBuilderProps,
      enableDragAndDrop: false,
      disabled: r.disabled,
      fields: r.subproperties.fields,
      enableMountQueryChange: !isRuleGroup(r.rule.value) || !r.rule.value.id,
      query: isRuleGroup(r.rule.value) ? r.rule.value : initialQuery,
      onQueryChange: r.onChangeValue
    });
    const subQuery = useRuleGroup({
      ...subQB,
      ruleGroup: subQB.rootGroup,
      path: rootPath,
      disabled: r.disabled,
      parentDisabled: subQB.queryDisabled,
      id: subQB.rootGroup.id,
      shiftUpDisabled: true,
      shiftDownDisabled: true
    });
    const addRule = useStopEventPropagation(subQuery.addRule);
    const addGroup = useStopEventPropagation(subQuery.addGroup);
    const cloneGroup = useStopEventPropagation(subQuery.cloneGroup);
    const toggleLockGroup = useStopEventPropagation(subQuery.toggleLockGroup);
    const removeGroup = useStopEventPropagation(subQuery.removeGroup);
    const shiftGroupUp = useStopEventPropagation(subQuery.shiftGroupUp);
    const shiftGroupDown = useStopEventPropagation(subQuery.shiftGroupDown);
    const memoizedSubQuery = useMemo(() => ({
      ...subQuery,
      addGroup,
      addRule,
      cloneGroup,
      removeGroup,
      shiftGroupDown,
      shiftGroupUp,
      toggleLockGroup
    }), [
      addGroup,
      addRule,
      cloneGroup,
      removeGroup,
      shiftGroupDown,
      shiftGroupUp,
      subQuery,
      toggleLockGroup
    ]);
    return /* @__PURE__ */ createElement(RuleComponents, {
      ...r,
      groupComponentsWrapper: r.groupComponentsWrapper ?? RuleWithSubQueryGroupComponentsWrapper,
      subQuery: memoizedSubQuery
    });
  });
  var useRule = (props) => {
    const { id, path, rule: ruleProp, schema: { classNames: classNamesProp, fields, fieldMap, getInputType, getMatchModes, getOperators, getSubQueryBuilderProps, getValueEditorType, getValueEditorSeparator, getValueSources, getValues, validationMap, enableDragAndDrop, getRuleClassname, suppressStandardClassnames }, actions: { moveRule, onPropChange, onRuleRemove }, disabled: disabledProp, parentDisabled, parentMuted, shiftUpDisabled, shiftDownDisabled, field: fieldProp, operator: operatorProp, value: valueProp, valueSource: valueSourceProp, dropEffect = "move", groupItems = false, dragMonitorId = "", dropMonitorId = "", dndRef = null, dragRef = null, isDragging = false, isOver = false, dropNotAllowed = false } = props;
    useDeprecatedProps("rule", !ruleProp);
    useReactDndWarning(enableDragAndDrop, !!(dragMonitorId || dropMonitorId || dndRef || dragRef));
    const disabled = !!parentDisabled || !!disabledProp;
    const muted = !!parentMuted || !!ruleProp?.muted;
    const rule = useMemo(() => ruleProp ?? {
      id,
      field: fieldProp ?? "",
      operator: operatorProp ?? "",
      value: valueProp,
      valueSource: valueSourceProp
    }, [
      fieldProp,
      id,
      operatorProp,
      ruleProp,
      valueProp,
      valueSourceProp
    ]);
    const classNames = useMemo(() => ({
      shiftActions: clsx(suppressStandardClassnames || standardClassnames.shiftActions, classNamesProp.shiftActions),
      dragHandle: clsx(suppressStandardClassnames || standardClassnames.dragHandle, classNamesProp.dragHandle),
      fields: clsx(suppressStandardClassnames || standardClassnames.fields, classNamesProp.valueSelector, classNamesProp.fields),
      matchMode: clsx(suppressStandardClassnames || standardClassnames.matchMode, classNamesProp.valueSelector, classNamesProp.matchMode),
      matchThreshold: clsx(suppressStandardClassnames || standardClassnames.matchThreshold, classNamesProp.valueSelector, classNamesProp.matchThreshold),
      operators: clsx(suppressStandardClassnames || standardClassnames.operators, classNamesProp.valueSelector, classNamesProp.operators),
      valueSource: clsx(suppressStandardClassnames || standardClassnames.valueSource, classNamesProp.valueSelector, classNamesProp.valueSource),
      value: clsx(suppressStandardClassnames || standardClassnames.value, classNamesProp.value),
      cloneRule: clsx(suppressStandardClassnames || standardClassnames.cloneRule, classNamesProp.actionElement, classNamesProp.cloneRule),
      lockRule: clsx(suppressStandardClassnames || standardClassnames.lockRule, classNamesProp.actionElement, classNamesProp.lockRule),
      muteRule: clsx(suppressStandardClassnames || standardClassnames.muteRule, classNamesProp.actionElement, classNamesProp.muteRule),
      removeRule: clsx(suppressStandardClassnames || standardClassnames.removeRule, classNamesProp.actionElement, classNamesProp.removeRule),
      valueListItem: clsx(suppressStandardClassnames || standardClassnames.valueListItem, classNamesProp.valueListItem)
    }), [
      classNamesProp.shiftActions,
      classNamesProp.dragHandle,
      classNamesProp.valueSelector,
      classNamesProp.fields,
      classNamesProp.matchMode,
      classNamesProp.matchThreshold,
      classNamesProp.operators,
      classNamesProp.valueSource,
      classNamesProp.value,
      classNamesProp.actionElement,
      classNamesProp.cloneRule,
      classNamesProp.lockRule,
      classNamesProp.muteRule,
      classNamesProp.removeRule,
      classNamesProp.valueListItem,
      suppressStandardClassnames
    ]);
    const getChangeHandler = useCallback((prop) => (value, context) => {
      if (!disabled) onPropChange(prop, value, path, context);
    }, [
      disabled,
      onPropChange,
      path
    ]);
    const onChangeField = useMemo(() => getChangeHandler("field"), [getChangeHandler]);
    const onChangeOperator = useMemo(() => getChangeHandler("operator"), [getChangeHandler]);
    const onChangeMatchMode = useMemo(() => getChangeHandler("match"), [getChangeHandler]);
    const onChangeValueSource = useMemo(() => getChangeHandler("valueSource"), [getChangeHandler]);
    const onChangeValue = useMemo(() => getChangeHandler("value"), [getChangeHandler]);
    const cloneRule = useCallback((_event, context) => {
      if (!disabled) moveRule(path, [...getParentPath(path), path.at(-1) + 1], true, context);
    }, [
      disabled,
      moveRule,
      path
    ]);
    const toggleLockRule = useCallback((_event, context) => onPropChange("disabled", !disabled, path, context), [
      disabled,
      onPropChange,
      path
    ]);
    const toggleMuteRule = useCallback((_event, context) => onPropChange("muted", !rule.muted, path, context), [
      rule.muted,
      onPropChange,
      path
    ]);
    const removeRule = useCallback((_event, _context) => {
      if (!disabled) onRuleRemove(path);
    }, [
      disabled,
      onRuleRemove,
      path
    ]);
    const shiftRuleUp = useCallback((event, context) => {
      if (!disabled && !shiftUpDisabled) moveRule(path, "up", event?.altKey, context);
    }, [
      disabled,
      moveRule,
      path,
      shiftUpDisabled
    ]);
    const shiftRuleDown = useCallback((event, context) => {
      if (!disabled && !shiftDownDisabled) moveRule(path, "down", event?.altKey, context);
    }, [
      disabled,
      moveRule,
      path,
      shiftDownDisabled
    ]);
    const fieldData = useMemo(() => fieldMap?.[rule.field] ?? {
      name: rule.field,
      value: rule.field,
      label: rule.field
    }, [fieldMap, rule.field]);
    const inputType = useMemo(() => fieldData.inputType ?? getInputType(rule.field, rule.operator, { fieldData }), [
      fieldData,
      getInputType,
      rule.field,
      rule.operator
    ]);
    const matchModes = useMemo(() => getMatchModes(rule.field, { fieldData }), [
      fieldData,
      getMatchModes,
      rule.field
    ]);
    const operators = useMemo(() => getOperators(rule.field, { fieldData }), [
      fieldData,
      getOperators,
      rule.field
    ]);
    const operatorObject = useMemo(() => getOption(operators, rule.operator), [operators, rule.operator]);
    const arity = operatorObject?.arity;
    const hideValueControls = typeof arity === "string" && arity === "unary" || typeof arity === "number" && arity < 2;
    const valueSourceOptions = useMemo(() => {
      const configuredVSs = getValueSources(rule.field, rule.operator, { fieldData });
      if (rule.valueSource && !getOption(configuredVSs, rule.valueSource)) return [...configuredVSs, {
        name: rule.valueSource,
        value: rule.valueSource,
        label: rule.valueSource
      }];
      return configuredVSs;
    }, [
      fieldData,
      getValueSources,
      rule.field,
      rule.operator,
      rule.valueSource
    ]);
    const valueSources = useMemo(() => valueSourceOptions.map(({ value }) => value), [valueSourceOptions]);
    const valueEditorType = useMemo(() => rule.valueSource === "field" ? "select" : getValueEditorType(rule.field, rule.operator, { fieldData }), [
      fieldData,
      getValueEditorType,
      rule.field,
      rule.operator,
      rule.valueSource
    ]);
    const valueEditorSeparator = useMemo(() => getValueEditorSeparator(rule.field, rule.operator, { fieldData }), [
      fieldData,
      getValueEditorSeparator,
      rule.field,
      rule.operator
    ]);
    const values = useMemo(() => {
      const v = rule.valueSource === "field" ? filterFieldsByComparator(fieldData, fields, rule.operator) : getValues(rule.field, rule.operator, { fieldData });
      return isFlexibleOptionArray(v) || isFlexibleOptionGroupArray(v) ? toFullOptionList(v) : v;
    }, [
      fieldData,
      fields,
      getValues,
      rule.field,
      rule.operator,
      rule.valueSource
    ]);
    const subQueryBuilderProps = useMemo(() => getSubQueryBuilderProps(rule.field, { fieldData }), [
      fieldData,
      getSubQueryBuilderProps,
      rule.field
    ]);
    const subproperties = useFields({
      translations: props.translations,
      fields: fieldData.subproperties ?? subQueryBuilderProps.fields ?? defaultSubproperties,
      autoSelectField: props.schema.autoSelectField || !!fieldData.subproperties
    });
    const validationResult = useMemo(() => validationMap[id ?? ""] ?? (typeof fieldData.validator === "function" ? fieldData.validator(rule) : null), [
      fieldData,
      id,
      rule,
      validationMap
    ]);
    const validationClassName = useMemo(() => getValidationClassNames(validationResult), [validationResult]);
    const fieldBasedClassName = fieldData?.className ?? "";
    const operatorBasedClassName = operatorObject?.className ?? "";
    const hasSubQuery = matchModes.length > 0;
    const outerClassName = useMemo(() => clsx(getRuleClassname(rule, { fieldData }), fieldBasedClassName, operatorBasedClassName, suppressStandardClassnames || standardClassnames.rule, classNamesProp.rule, disabled && classNamesProp.disabled, muted && classNamesProp.muted, isDragging && classNamesProp.dndDragging, isOver && classNamesProp.dndOver, isOver && dropEffect === "copy" && classNamesProp.dndCopy, isOver && groupItems && classNamesProp.dndGroup, dropNotAllowed && classNamesProp.dndDropNotAllowed, hasSubQuery && classNamesProp.hasSubQuery, suppressStandardClassnames || {
      [standardClassnames.disabled]: disabled,
      [standardClassnames.muted]: muted,
      [standardClassnames.dndDragging]: isDragging,
      [standardClassnames.dndOver]: isOver,
      [standardClassnames.dndCopy]: isOver && dropEffect === "copy",
      [standardClassnames.dndGroup]: isOver && groupItems,
      [standardClassnames.dndDropNotAllowed]: dropNotAllowed,
      [standardClassnames.hasSubQuery]: hasSubQuery
    }, validationClassName), [
      classNamesProp.disabled,
      classNamesProp.muted,
      classNamesProp.dndCopy,
      classNamesProp.dndDragging,
      classNamesProp.dndGroup,
      classNamesProp.dndOver,
      classNamesProp.dndDropNotAllowed,
      classNamesProp.hasSubQuery,
      classNamesProp.rule,
      disabled,
      dropEffect,
      dropNotAllowed,
      muted,
      fieldBasedClassName,
      fieldData,
      getRuleClassname,
      groupItems,
      hasSubQuery,
      isDragging,
      isOver,
      operatorBasedClassName,
      rule,
      suppressStandardClassnames,
      validationClassName
    ]);
    return {
      ...props,
      classNames,
      cloneRule,
      disabled,
      dndRef,
      dragMonitorId,
      dragRef,
      dropMonitorId,
      fieldData,
      generateOnChangeHandler: getChangeHandler,
      onChangeField,
      onChangeMatchMode,
      onChangeOperator,
      onChangeValueSource,
      onChangeValue,
      hideValueControls,
      inputType,
      matchModes,
      muted,
      operators,
      outerClassName,
      removeRule,
      rule,
      shiftRuleUp,
      shiftRuleDown,
      subproperties,
      subQueryBuilderProps,
      toggleLockRule,
      toggleMuteRule,
      validationResult,
      valueEditorSeparator,
      valueEditorType,
      values,
      valueSourceOptions,
      valueSources
    };
  };
  var defaultControlElements = {
    actionElement: ActionElement,
    addGroupAction: ActionElement,
    addRuleAction: ActionElement,
    cloneGroupAction: ActionElement,
    cloneRuleAction: ActionElement,
    combinatorSelector: ValueSelector,
    dragHandle: DragHandle,
    fieldSelector: ValueSelector,
    inlineCombinator: InlineCombinator,
    lockGroupAction: ActionElement,
    lockRuleAction: ActionElement,
    matchModeEditor: MatchModeEditor,
    muteGroupAction: ActionElement,
    muteRuleAction: ActionElement,
    notToggle: NotToggle,
    operatorSelector: ValueSelector,
    removeGroupAction: ActionElement,
    removeRuleAction: ActionElement,
    rule: Rule,
    ruleGroup: RuleGroup,
    ruleGroupBodyElements: RuleGroupBodyComponents,
    ruleGroupHeaderElements: RuleGroupHeaderComponents,
    shiftActions: ShiftActions,
    valueEditor: ValueEditor,
    valueSelector: ValueSelector,
    valueSourceSelector: ValueSelector
  };

  // node_modules/react-querybuilder/dist/react-querybuilder.mjs
  init_react_global_shim();
  var queryBuilderStore = getRqbStore();
  var QueryBuilderStateProvider = (props) => /* @__PURE__ */ createElement(Provider_default, {
    context: QueryBuilderStateContext,
    store: getRqbStore()
  }, props.children);
  var QueryBuilder = (props) => /* @__PURE__ */ createElement(QueryBuilderStateProvider, null, /* @__PURE__ */ createElement(QueryBuilderInternal, { props }));

  // src/querybuilder-global.jsx
  window.VyasaTasksQueryBuilder = { QueryBuilder };
})();
/*! Bundled license information:

use-sync-external-store/cjs/use-sync-external-store-with-selector.production.js:
  (**
   * @license React
   * use-sync-external-store-with-selector.production.js
   *
   * Copyright (c) Meta Platforms, Inc. and affiliates.
   *
   * This source code is licensed under the MIT license found in the
   * LICENSE file in the root directory of this source tree.
   *)

@react-querybuilder/core/dist/react-querybuilder_core.mjs:
  (* v8 ignore start -- @preserve *)
  (* v8 ignore stop -- @preserve *)

@react-querybuilder/core/dist/react-querybuilder_core.mjs:
@react-querybuilder/core/dist/react-querybuilder_core.mjs:
  (* v8 ignore next -- @preserve *)

react-querybuilder/dist/defaults-g6J_xYY8.mjs:
  (* v8 ignore else -- @preserve *)
*/
