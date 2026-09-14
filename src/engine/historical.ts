import type { HistoricalBootstrapSettings, HistoricalPoint } from "../domain";
import type { MonthlyObservation, ReturnGenerator } from "./returns";

const REQUIRED_HEADERS = ["date", "portfolio_return", "inflation"] as const;

function splitCsvRow(line: string): string[] {
  const cells: string[] = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < line.length; index++) {
    const character = line[index];
    if (character === '"') {
      if (quoted && line[index + 1] === '"') {
        cell += '"';
        index++;
      } else {
        quoted = !quoted;
      }
    } else if (character === "," && !quoted) {
      cells.push(cell.trim());
      cell = "";
    } else {
      cell += character;
    }
  }
  if (quoted) throw new Error("Historical CSV contains an unclosed quote.");
  cells.push(cell.trim());
  return cells;
}

function datasetHash(rows: HistoricalPoint[]): string {
  let hash = 0x811c9dc5;
  for (const character of JSON.stringify(rows)) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

export function parseHistoricalCsv(text: string, fileName: string): HistoricalBootstrapSettings {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter(line => line.trim());
  if (lines.length < 2) throw new Error("Historical CSV must contain a header and monthly data.");
  const headers = splitCsvRow(lines[0]).map(header => header.toLowerCase());
  if (headers.length !== REQUIRED_HEADERS.length || REQUIRED_HEADERS.some((header, index) => headers[index] !== header)) {
    throw new Error("Historical CSV headers must be: date,portfolio_return,inflation.");
  }
  const rows = lines.slice(1).map((line, index): HistoricalPoint => {
    const cells = splitCsvRow(line);
    if (cells.length !== REQUIRED_HEADERS.length) throw new Error(`Historical CSV row ${index + 2} must have three columns.`);
    const portfolioReturn = Number(cells[1]);
    const inflation = Number(cells[2]);
    if (!cells[1] || !cells[2] || !Number.isFinite(portfolioReturn) || !Number.isFinite(inflation)) {
      throw new Error(`Historical CSV row ${index + 2} contains a missing or invalid number.`);
    }
    return { date: cells[0], portfolioReturn, inflation };
  });
  const datasetName = fileName.replace(/\.csv$/i, "").trim().slice(0, 120) || "Imported historical data";
  return {
    blockMonths: 12,
    datasetName,
    datasetId: `user-${datasetHash(rows)}`,
    rows
  };
}

export function createMovingBlockGenerator(
  settings: HistoricalBootstrapSettings,
  random: () => number
): ReturnGenerator {
  const { rows, blockMonths } = settings;
  if (rows.length < blockMonths) throw new Error("Historical dataset is shorter than the selected block length.");
  let rowIndex = 0;
  let remainingInBlock = 0;
  return {
    nextMonthlyObservation(): MonthlyObservation {
      if (remainingInBlock === 0) {
        const possibleStarts = rows.length - blockMonths + 1;
        rowIndex = Math.floor(random() * possibleStarts);
        remainingInBlock = blockMonths;
      }
      const point = rows[rowIndex++];
      remainingInBlock--;
      return { monthlyReturn: point.portfolioReturn, monthlyInflation: point.inflation };
    }
  };
}
