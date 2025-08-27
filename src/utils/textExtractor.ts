export const extractTextFromPage = (): string => {
  const ignoredTags = ["SCRIPT", "STYLE", "NOSCRIPT", "META", "HEAD"];
  const ignoredSelectors = [
    "nav",
    "footer",
    "aside",
    ".navigation",
    ".sidebar",
    ".menu",
    ".advertisement",
    ".ads",
  ];

  const isIgnoredElement = (element: Element): boolean => {
    if (ignoredTags.includes(element.tagName)) return true;

    return ignoredSelectors.some((selector) => {
      try {
        return element.matches(selector);
      } catch {
        return false;
      }
    });
  };

  const extractTextRecursively = (element: Element): string => {
    if (isIgnoredElement(element)) return "";

    let text = "";

    for (const node of element.childNodes) {
      if (node.nodeType === Node.TEXT_NODE) {
        const nodeText = node.textContent?.trim();
        if (nodeText) {
          text += nodeText + " ";
        }
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        text += extractTextRecursively(node as Element);
      }
    }

    return text;
  };

  const mainContent =
    document.querySelector("main, article, .content, #content") ||
    document.body;
  return extractTextRecursively(mainContent).trim();
};
