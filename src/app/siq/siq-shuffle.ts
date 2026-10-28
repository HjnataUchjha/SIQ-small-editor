import { parseContentXml, type LoadedSiq } from "./siq-package";

interface ThemeSettings {
  readonly questionsPerTheme: number;
  readonly themeName: string;
  readonly numberThemes: boolean;
}

interface RoundSettings extends ThemeSettings {
  readonly roundCount: number;
  readonly themesPerRound: number;
}

export type ShuffleOptions =
  | ({ readonly mode: "all" } & RoundSettings)
  | ({
      readonly mode: "rounds";
      readonly roundIds: readonly string[];
    } & RoundSettings)
  | ({
      readonly mode: "themes";
      readonly themeIds: readonly string[];
    } & ThemeSettings)
  | { readonly mode: "single-theme"; readonly themeId: string };

export type ShuffleMode = ShuffleOptions["mode"];

export interface ShuffleResult extends Pick<
  LoadedSiq,
  "contentXml" | "document" | "structure"
> {
  readonly questionCount: number;
  readonly createdRoundCount: number;
  readonly createdThemeCount: number;
  readonly requestedRoundCount: number | null;
}

interface ThemeReference {
  readonly id: string;
  readonly element: Element;
  readonly questions: Element[];
  readonly round: RoundReference;
}

interface RoundReference {
  readonly id: string;
  readonly element: Element;
  readonly isFinal: boolean;
  readonly themes: ThemeReference[];
}

function children(parent: Element | undefined, name: string): Element[] {
  return parent
    ? Array.from(parent.children).filter(
        (child) =>
          child.localName === name &&
          child.namespaceURI === parent.namespaceURI,
      )
    : [];
}

function requirePositiveInteger(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new Error(`${label}: введите целое положительное число`);
  }
}

function shuffled<T>(items: readonly T[], random: () => number): T[] {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index--) {
    const value = random();
    if (!Number.isFinite(value) || value < 0 || value >= 1) {
      throw new Error(
        "Не удалось получить случайный порядок вопросов. Повторите операцию",
      );
    }
    const other = Math.floor(value * (index + 1));
    [result[index], result[other]] = [result[other], result[index]];
  }
  return result;
}

function select<T extends { readonly id: string }>(
  ids: readonly string[],
  items: readonly T[],
  label: string,
): T[] {
  if (!ids.length) throw new Error(`Выберите ${label} для перемешивания`);
  const byId = new Map(items.map((item) => [item.id, item]));
  return [...new Set(ids)].map((id) => {
    const item = byId.get(id);
    if (!item)
      throw new Error(
        "Выбранный элемент больше не существует. Выберите элементы заново",
      );
    return item;
  });
}

export function shuffleContentXml(
  contentXml: string,
  options: ShuffleOptions,
  random: () => number = Math.random,
): ShuffleResult {
  const { document } = parseContentXml(contentXml);
  const roundsElement = children(document.documentElement, "rounds")[0];
  const rounds: RoundReference[] = children(roundsElement, "round").map(
    (element, roundIndex) => {
      const round: RoundReference = {
        id: `round-${roundIndex}`,
        element,
        isFinal: element.getAttribute("type") === "final",
        themes: [],
      };
      round.themes.push(
        ...children(children(element, "themes")[0], "theme").map(
          (theme, themeIndex) => ({
            id: `${round.id}-theme-${themeIndex}`,
            element: theme,
            questions: children(children(theme, "questions")[0], "question"),
            round,
          }),
        ),
      );
      return round;
    },
  );
  const themes = rounds.flatMap((round) => round.themes);

  let selectedRounds: RoundReference[] = [];
  let selectedThemes: ThemeReference[];
  switch (options.mode) {
    case "all":
      selectedRounds = rounds.filter((round) => !round.isFinal);
      selectedThemes = selectedRounds.flatMap((round) => round.themes);
      break;
    case "rounds":
      selectedRounds = select(options.roundIds, rounds, "раунды");
      selectedThemes = selectedRounds.flatMap((round) => round.themes);
      break;
    case "themes":
      selectedThemes = select(options.themeIds, themes, "темы");
      break;
    case "single-theme":
      selectedThemes = select([options.themeId], themes, "тему");
      break;
    default:
      throw new Error("Неизвестный способ перемешивания");
  }
  if (
    selectedRounds.some((round) => round.isFinal) ||
    selectedThemes.some((theme) => theme.round.isFinal)
  ) {
    throw new Error("Финальные раунды и их темы не участвуют в перемешивании");
  }

  if (options.mode !== "single-theme") {
    requirePositiveInteger(
      options.questionsPerTheme,
      "Количество вопросов в теме",
    );
    if (!options.themeName.trim())
      throw new Error("Введите название новых тем");
    if (options.mode !== "themes") {
      requirePositiveInteger(options.roundCount, "Количество раундов");
      requirePositiveInteger(options.themesPerRound, "Количество тем в раунде");
    }
  }
  const pool = selectedThemes.flatMap((theme) => theme.questions);
  if (!pool.length)
    throw new Error("В выбранной области нет вопросов для перемешивания");
  const questions = shuffled(pool, random);
  let createdRoundCount = 0;
  let createdThemeCount = 0;

  if (options.mode === "single-theme") {
    const slots = pool.map((question) => {
      const marker = document.createComment("question-slot");
      question.replaceWith(marker);
      return marker;
    });
    slots.forEach((slot, index) => slot.replaceWith(questions[index]));
  } else {
    const makeElement = (name: string): Element =>
      document.createElementNS(
        roundsElement.namespaceURI,
        roundsElement.prefix ? `${roundsElement.prefix}:${name}` : name,
      );
    const themeCount = Math.ceil(questions.length / options.questionsPerTheme);
    const themesPerRound =
      options.mode === "themes" ? themeCount : options.themesPerRound;
    const newRounds = document.createDocumentFragment();
    let newThemes: Element | undefined;

    for (let themeIndex = 0; themeIndex < themeCount; themeIndex++) {
      if (themeIndex % themesPerRound === 0) {
        const round = makeElement("round");
        round.setAttribute("name", `Раунд ${++createdRoundCount}`);
        newThemes = makeElement("themes");
        round.appendChild(newThemes);
        newRounds.appendChild(round);
      }
      const theme = makeElement("theme");
      theme.setAttribute(
        "name",
        options.themeName.trim() +
          (options.numberThemes ? ` ${themeIndex + 1}` : ""),
      );
      const container = makeElement("questions");
      const start = themeIndex * options.questionsPerTheme;
      for (const question of questions.slice(
        start,
        start + options.questionsPerTheme,
      )) {
        container.appendChild(question);
      }
      theme.appendChild(container);
      newThemes!.appendChild(theme);
      createdThemeCount++;
    }

    if (options.mode === "themes") {
      const affectedRounds = new Set(
        selectedThemes.map((theme) => theme.round),
      );
      selectedThemes.forEach((theme) => theme.element.remove());
      for (const round of affectedRounds) {
        if (!children(children(round.element, "themes")[0], "theme").length)
          round.element.remove();
      }
    } else {
      selectedRounds.forEach((round) => round.element.remove());
    }
    roundsElement.insertBefore(newRounds, roundsElement.firstChild);
  }

  const resultXml = new XMLSerializer().serializeToString(document);
  return {
    contentXml: resultXml,
    ...parseContentXml(resultXml),
    questionCount: questions.length,
    createdRoundCount,
    createdThemeCount,
    requestedRoundCount:
      options.mode === "all" || options.mode === "rounds"
        ? options.roundCount
        : null,
  };
}
