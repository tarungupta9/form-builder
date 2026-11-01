import { type IsoDateTime, type ResponseId, toIsoDate } from '../../domain/ids';
import type { SubmittedResponse } from '../../domain/response';
import type { ExportBlock } from '../../fields/contract';
import { definitionOf } from '../../fields/registry';

/**
 * Everything an exported response shows, in the order it shows it. The same model is printed
 * to PDF and shown on screen, so the two cannot disagree (ADR 0011).
 */
export interface ExportDocument {
  title: string;
  /** `''` means none (D-32). */
  description: string;
  responseId: ResponseId;
  /** Formatted when rendered, so the model stays pure and free of locale and time zone. */
  submittedAt: IsoDateTime;
  /** One per field of the snapshot, in form order. */
  blocks: ExportBlock[];
}

/**
 * Builds the export from the response alone. The snapshot holds only the fields that were
 * visible at submit, so a hidden field is absent here too, and editing the template later
 * never changes a past response's export (D-10). Each field's plugin decides how it reads.
 */
export function toExportModel(response: SubmittedResponse): ExportDocument {
  const { snapshot, answers } = response;
  return {
    title: snapshot.title,
    description: snapshot.description,
    responseId: response.id,
    submittedAt: response.submittedAt,
    blocks: snapshot.fields.map((field) => {
      const definition = definitionOf(field);
      return definition.toExport(field, definition.readValue(field, answers[field.id]));
    }),
  };
}

/** Characters Windows and macOS refuse in a file name. */
const UNSAFE_IN_FILE_NAME = /[\\/:*?"<>|]/g;

/**
 * The PDF's suggested file name, which browsers take from the document title:
 * "Expense claim – response 2026-11-01 0905", in local time, so a downloads folder sorts by date.
 */
export function pdfFileName(document: Pick<ExportDocument, 'title' | 'submittedAt'>): string {
  const at = new Date(document.submittedAt);
  const time = [at.getHours(), at.getMinutes()].map((n) => String(n).padStart(2, '0')).join('');
  const title = document.title.replace(UNSAFE_IN_FILE_NAME, '-');
  return `${title} – response ${toIsoDate(at)} ${time}`;
}
