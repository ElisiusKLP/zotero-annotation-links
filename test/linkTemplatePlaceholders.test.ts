import { assert } from "chai";
import { config } from "../package.json";
import { buildAnnotationLinkText } from "../src/modules/linkTemplate";

const TEMPLATE_PREF = `${config.prefsPrefix}.linkTemplate`;

async function createPdfAttachment(parentItem?: Zotero.Item) {
  const attachment = new Zotero.Item("attachment");
  if (parentItem) {
    attachment.parentID = parentItem.id;
  }
  attachment.attachmentLinkMode = Zotero.Attachments.LINK_MODE_IMPORTED_FILE;
  attachment.attachmentContentType = "application/pdf";
  attachment.setField("title", "Example Attachment");
  await attachment.saveTx();
  return attachment;
}

async function createAnnotation(
  attachment: Zotero.Item,
  type: "highlight" | "image",
  text?: string,
) {
  const annotation = new Zotero.Item("annotation");
  annotation.libraryID = attachment.libraryID;
  annotation.parentID = attachment.id;
  annotation.annotationType = type;
  if (text) {
    annotation.annotationText = text;
  }
  annotation.annotationColor = "#ffd400";
  annotation.annotationPageLabel = "iv";
  // @ts-expect-error - Sort index is typed as a number, but Zotero expects a string
  annotation.annotationSortIndex = "00003|000283|00100";
  annotation.annotationPosition = JSON.stringify({
    pageIndex: 3,
    rects: [[100, 200, 300, 220]],
  });
  await annotation.saveTx();
  return annotation;
}

function setTemplate(template: string) {
  Zotero.Prefs.set(TEMPLATE_PREF, template, true);
}

describe("buildAnnotationLinkText", function () {
  let parentItem: Zotero.Item;
  let attachment: Zotero.Item;
  let annotation: Zotero.Item;
  let link: string;

  before(async function () {
    parentItem = new Zotero.Item("journalArticle");
    parentItem.setField("title", "An Example Paper");
    await parentItem.saveTx();
    attachment = await createPdfAttachment(parentItem);
    annotation = await createAnnotation(
      attachment,
      "highlight",
      "an example\n  highlighted sentence",
    );
    link = `zotero://open-pdf/library/items/${attachment.key}?page=iv&annotation=${annotation.key}`;
  });

  afterEach(function () {
    Zotero.Prefs.clear(TEMPLATE_PREF, true);
  });

  after(async function () {
    await parentItem.eraseTx();
  });

  it("should copy the plain link by default", function () {
    assert.equal(buildAnnotationLinkText(attachment, annotation.key), link);
  });

  it("should copy the plain link for an empty template", function () {
    setTemplate("");
    assert.equal(buildAnnotationLinkText(attachment, annotation.key), link);
  });

  it("should replace {link}", function () {
    setTemplate("<{link}>");
    assert.equal(
      buildAnnotationLinkText(attachment, annotation.key),
      `<${link}>`,
    );
  });

  it("should replace {page} with the page label", function () {
    setTemplate("p. {page}");
    assert.equal(buildAnnotationLinkText(attachment, annotation.key), "p. iv");
  });

  it("should replace {title} with the parent item's title", function () {
    setTemplate("{title}");
    assert.equal(
      buildAnnotationLinkText(attachment, annotation.key),
      "An Example Paper",
    );
  });

  it("should replace {text} with the highlighted text on one line", function () {
    setTemplate("> {text}");
    assert.equal(
      buildAnnotationLinkText(attachment, annotation.key),
      "> an example highlighted sentence",
    );
  });

  it("should replace {annotationKey} and {itemKey}", function () {
    setTemplate("{annotationKey} {itemKey}");
    assert.equal(
      buildAnnotationLinkText(attachment, annotation.key),
      `${annotation.key} ${attachment.key}`,
    );
  });

  it("should replace all placeholders in one template", function () {
    setTemplate("[{title}, p. {page}]({link}) {text}");
    assert.equal(
      buildAnnotationLinkText(attachment, annotation.key),
      `[An Example Paper, p. iv](${link}) an example highlighted sentence`,
    );
  });

  it("should replace {text} with nothing for an image annotation", async function () {
    const imageAnnotation = await createAnnotation(attachment, "image");
    setTemplate("[{text}]");
    assert.equal(
      buildAnnotationLinkText(attachment, imageAnnotation.key),
      "[]",
    );
  });

  it("should use the attachment's title for a standalone PDF", async function () {
    const standaloneAttachment = await createPdfAttachment();
    const standaloneAnnotation = await createAnnotation(
      standaloneAttachment,
      "highlight",
      "text",
    );
    setTemplate("{title}");
    try {
      assert.equal(
        buildAnnotationLinkText(standaloneAttachment, standaloneAnnotation.key),
        "Example Attachment",
      );
    } finally {
      await standaloneAttachment.eraseTx();
    }
  });
});
