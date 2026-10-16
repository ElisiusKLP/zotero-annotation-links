import { getPref } from "../utils/prefs";
import { buildAnnotationUrl } from "./urlBuilder";

const DEFAULT_LINK_TEMPLATE = "{link}";

/**
 * Build the text copied to the clipboard for an annotation link.
 * The link is wrapped in the user's link template (Settings > Annotation Links),
 * e.g. `[Page {page}]({link})` for a Markdown link.
 * See docs/link-template.md for the available placeholders.
 * @param attachment
 * @param annotationKey
 */
export function buildAnnotationLinkText(
  attachment: Zotero.Item,
  annotationKey: string,
): string {
  const template = getPref("linkTemplate") || DEFAULT_LINK_TEMPLATE;
  const annotationItem = Zotero.Items.getByLibraryAndKey(
    attachment.libraryID,
    annotationKey,
  );

  // For attachments, prefer the parent item's title
  const titleItem = attachment.parentItem || attachment;

  return applyLinkTemplate(template, {
    link: buildAnnotationUrl(attachment, annotationKey),
    page: (annotationItem && annotationItem.annotationPageLabel) || "",
    title: titleItem.getDisplayTitle(),
    // Keep multi-line highlights on one line so the template stays intact
    text: ((annotationItem && annotationItem.annotationText) || "")
      .replace(/\s+/g, " ")
      .trim(),
    annotationKey,
    itemKey: attachment.key,
  });
}

/**
 * Replace `{name}` placeholders in the template with their values.
 * Unknown placeholders are left as they are.
 * @param template
 * @param values
 * @example
 * ```js
 * applyLinkTemplate("[Page {page}]({link})", { page: "2", link: "zotero://..." });
 * // [Page 2](zotero://...)
 * ```
 */
export function applyLinkTemplate(
  template: string,
  values: Record<string, string>,
): string {
  return template.replace(/\{(\w+)\}/g, (placeholder, name: string) =>
    Object.prototype.hasOwnProperty.call(values, name)
      ? values[name]
      : placeholder,
  );
}
