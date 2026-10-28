import JSZip from "jszip";

export interface SiqQuestion {
  readonly id: string;
  readonly price: string | null;
}

export interface SiqTheme {
  readonly id: string;
  readonly name: string;
  readonly questions: readonly SiqQuestion[];
}

export interface SiqRound {
  readonly id: string;
  readonly name: string;
  readonly isFinal: boolean;
  readonly themes: readonly SiqTheme[];
  readonly questionCount: number;
}

export interface SiqStructure {
  readonly name: string;
  readonly rounds: readonly SiqRound[];
  readonly themeCount: number;
  readonly questionCount: number;
}

export interface LoadedSiq {
  readonly fileName: string;
  readonly fileSize: number;
  readonly archive: JSZip;
  readonly contentXml: string;
  readonly document: XMLDocument;
  readonly structure: SiqStructure;
}

function children(
  parent: Element | undefined,
  name: string,
  namespace: string | null,
): Element[] {
  return parent
    ? Array.from(parent.children).filter(
        (element) =>
          element.localName === name && element.namespaceURI === namespace,
      )
    : [];
}

export function parseContentXml(
  contentXml: string,
): Pick<LoadedSiq, "document" | "structure"> {
  const document = new DOMParser().parseFromString(
    contentXml,
    "application/xml",
  );
  const root = document.documentElement;
  if (
    !root ||
    root.localName === "parsererror" ||
    document.getElementsByTagNameNS(
      "http://www.mozilla.org/newlayout/xml/parsererror.xml",
      "parsererror",
    ).length
  ) {
    throw new Error("Не удалось прочитать content.xml: некорректный XML");
  }
  if (root.localName !== "package") {
    throw new Error(
      "Неверная структура content.xml: корневой элемент должен называться package",
    );
  }

  const namespace = root.namespaceURI;
  const roundsElement = children(root, "rounds", namespace)[0];
  if (!roundsElement)
    throw new Error("В content.xml отсутствует раздел rounds");

  let themeCount = 0;
  let questionCount = 0;
  const rounds = children(roundsElement, "round", namespace).map(
    (round, roundIndex): SiqRound => {
      const roundId = `round-${roundIndex}`;
      const themes = children(
        children(round, "themes", namespace)[0],
        "theme",
        namespace,
      ).map((theme, themeIndex): SiqTheme => {
        const themeId = `${roundId}-theme-${themeIndex}`;
        const questions = children(
          children(theme, "questions", namespace)[0],
          "question",
          namespace,
        ).map(
          (question, questionIndex): SiqQuestion => ({
            id: `${themeId}-question-${questionIndex}`,
            price: question.getAttribute("price"),
          }),
        );
        themeCount++;
        questionCount += questions.length;
        return {
          id: themeId,
          name: theme.getAttribute("name")?.trim() || `Тема ${themeIndex + 1}`,
          questions,
        };
      });
      return {
        id: roundId,
        name: round.getAttribute("name")?.trim() || `Раунд ${roundIndex + 1}`,
        isFinal: round.getAttribute("type") === "final",
        themes,
        questionCount: themes.reduce(
          (count, theme) => count + theme.questions.length,
          0,
        ),
      };
    },
  );
  return {
    document,
    structure: {
      name: root.getAttribute("name")?.trim() || "Пакет без названия",
      rounds,
      themeCount,
      questionCount,
    },
  };
}

function decodeXml(bytes: Uint8Array): string {
  let encoding = "utf-8";
  if (
    (bytes[0] === 0xff && bytes[1] === 0xfe) ||
    (bytes[0] === 0x3c && bytes[1] === 0x00)
  ) {
    encoding = "utf-16le";
  } else if (
    (bytes[0] === 0xfe && bytes[1] === 0xff) ||
    (bytes[0] === 0x00 && bytes[1] === 0x3c)
  ) {
    encoding = "utf-16be";
  } else {
    const declaration = new TextDecoder().decode(bytes.subarray(0, 256));
    encoding =
      /^\uFEFF?\s*<\?xml\b[^?]*\bencoding\s*=\s*["']([^"']+)["']/i.exec(
        declaration,
      )?.[1] ?? encoding;
  }
  try {
    return new TextDecoder(encoding, { fatal: true }).decode(bytes);
  } catch {
    throw new Error("Не удалось прочитать кодировку content.xml");
  }
}

export async function loadSiq(file: File): Promise<LoadedSiq> {
  if (!file.name.toLowerCase().endsWith(".siq")) {
    throw new Error("Выберите пакет SIGame с расширением .siq");
  }

  let data: ArrayBuffer;
  try {
    data = await file.arrayBuffer();
  } catch {
    throw new Error(
      "Не удалось прочитать файл. Проверьте, что он доступен, и выберите его снова",
    );
  }

  let archive: JSZip;
  try {
    archive = await JSZip.loadAsync(data, {
      createFolders: false,
      checkCRC32: false,
    });
  } catch {
    throw new Error(
      "Не удалось открыть SIQ: ZIP-архив повреждён или его формат не поддерживается",
    );
  }

  const entry = archive.file("content.xml");
  if (!entry)
    throw new Error("В SIQ-архиве отсутствует файл content.xml в корне");

  let bytes: Uint8Array;
  try {
    bytes = await entry.async("uint8array");
  } catch {
    throw new Error(
      "Не удалось распаковать content.xml: запись в архиве повреждена",
    );
  }
  const contentXml = decodeXml(bytes);
  const parsed = parseContentXml(contentXml);
  return {
    fileName: file.name,
    fileSize: file.size,
    archive,
    contentXml,
    ...parsed,
  };
}
