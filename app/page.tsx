"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type DragEvent,
} from "react";

type Theme = "paper" | "sepia" | "night";
type ReaderFont = "georgia" | "palatino" | "times" | "segoe" | "arial";

type Chapter = {
  title: string;
  paragraphs: string[];
  fileName: string;
  key: string;
  encoding: string;
};

const SAMPLE_TEXT = `Chương 12: Lá thư không gửi

Mưa bắt đầu từ lúc thành phố vừa lên đèn. Những giọt nước mảnh như tơ nghiêng qua khung cửa, làm mọi thứ ngoài kia nhòe thành một bức tranh màu lam.

An đặt tách trà xuống, mở ngăn kéo cuối cùng của chiếc bàn gỗ. Lá thư vẫn ở đó — gấp làm tư, không đề tên người nhận.

“Có những điều, viết ra rồi cũng chưa chắc đã nhẹ lòng hơn.”

Cô đọc lại câu đầu tiên. Mực đã phai đôi chút, nhưng buổi chiều mùa hạ năm ấy vẫn hiện lên rõ ràng: tiếng ve, con đường đầy nắng, và một lời hẹn chẳng ai đủ can đảm để nhắc lại.

Ngoài hiên, tiếng mưa bỗng chậm. An mỉm cười, gấp lá thư lại và đặt nó vào túi áo.

Lần này, cô sẽ mang nó đi.`;

const THEMES: { id: Theme; label: string; swatch: string }[] = [
  { id: "paper", label: "Sáng", swatch: "○" },
  { id: "sepia", label: "Sepia", swatch: "◐" },
  { id: "night", label: "Tối", swatch: "●" },
];

const READER_FONTS: { id: ReaderFont; label: string }[] = [
  { id: "georgia", label: "Georgia" },
  { id: "palatino", label: "Palatino" },
  { id: "times", label: "Times New Roman" },
  { id: "segoe", label: "Segoe UI" },
  { id: "arial", label: "Arial" },
];

function scoreDecodedText(text: string) {
  const replacement = (text.match(/�/g) || []).length;
  const mojibake = (text.match(/Ã|Â|Æ|áº|á»/g) || []).length;
  return replacement * 12 + mojibake * 4;
}

function decodeFile(buffer: ArrayBuffer) {
  const utf8 = new TextDecoder("utf-8").decode(buffer);

  try {
    const vietnamese = new TextDecoder("windows-1258").decode(buffer);
    return scoreDecodedText(utf8) <= scoreDecodedText(vietnamese)
      ? { text: utf8, encoding: "UTF-8" }
      : { text: vietnamese, encoding: "Windows-1258" };
  } catch {
    return { text: utf8, encoding: "UTF-8" };
  }
}

function titleFromFileName(fileName: string) {
  return fileName
    .replace(/\.txt$/i, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseChapter(rawText: string, fileName: string) {
  const cleaned = rawText
    .replace(/^\uFEFF/, "")
    .replace(/\r\n?/g, "\n")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+$/gm, "")
    .trim();

  const lines = cleaned.split("\n").map((line) => line.trim());
  const firstIndex = lines.findIndex(Boolean);
  const firstLine = firstIndex >= 0 ? lines[firstIndex] : "";
  const looksLikeTitle =
    /^(chương|chapter|hồi|quyển|phần|ngoại truyện)\b/i.test(firstLine) ||
    (firstLine.length > 0 &&
      firstLine.length <= 90 &&
      lines[firstIndex + 1] === "");
  const fallbackTitle = titleFromFileName(fileName) || "Chương chưa đặt tên";
  const title = looksLikeTitle ? firstLine : fallbackTitle;
  const bodyLines = looksLikeTitle
    ? lines.slice(firstIndex + 1)
    : lines.slice(Math.max(firstIndex, 0));

  while (bodyLines.length && !bodyLines[0]) bodyLines.shift();
  while (bodyLines.length && !bodyLines[bodyLines.length - 1]) bodyLines.pop();

  const nonEmpty = bodyLines.filter(Boolean);
  const blankCount = bodyLines.length - nonEmpty.length;
  const hasParagraphBreaks = blankCount >= Math.max(1, nonEmpty.length * 0.04);
  const paragraphs: string[] = [];

  if (hasParagraphBreaks) {
    let buffer: string[] = [];
    const flush = () => {
      const paragraph = buffer.join(" ").replace(/\s+/g, " ").trim();
      if (paragraph) paragraphs.push(paragraph);
      buffer = [];
    };

    for (const line of bodyLines) {
      if (!line) {
        flush();
      } else if (/^[—–-]\s|^[“\"']/.test(line) && buffer.length) {
        flush();
        buffer.push(line);
      } else {
        buffer.push(line);
      }
    }
    flush();
  } else {
    const lengths = nonEmpty.map((line) => line.length);
    const wrappedLines =
      lengths.length > 5 &&
      lengths.filter((length) => length >= 55 && length <= 100).length /
        lengths.length >
        0.62;

    if (wrappedLines) {
      let buffer = "";
      for (const line of nonEmpty) {
        const startsDialogue = /^[—–-]\s|^[“\"']/.test(line);
        if (startsDialogue && buffer) {
          paragraphs.push(buffer.trim());
          buffer = line;
        } else {
          buffer = `${buffer} ${line}`.trim();
        }

        if (/[.!?…][”\"']?$/.test(line) && buffer.length >= 140) {
          paragraphs.push(buffer.trim());
          buffer = "";
        }
      }
      if (buffer) paragraphs.push(buffer.trim());
    } else {
      paragraphs.push(...nonEmpty);
    }
  }

  return { title, paragraphs };
}

export default function Home() {
  const [chapter, setChapter] = useState<Chapter | null>(null);
  const [theme, setTheme] = useState<Theme>("paper");
  const [fontSize, setFontSize] = useState(20);
  const [lineHeight, setLineHeight] = useState(1.85);
  const [readerWidth, setReaderWidth] = useState(760);
  const [fontFamily, setFontFamily] = useState<ReaderFont>("georgia");
  const [progress, setProgress] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState("");
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let saved: Record<string, unknown> = {};
    try {
      saved = JSON.parse(localStorage.getItem("mocdoc-settings") || "{}");
    } catch {
      // Keep the comfortable defaults if saved preferences are invalid.
    }
    const timer = window.setTimeout(() => {
      if (THEMES.some((item) => item.id === saved.theme)) setTheme(saved.theme as Theme);
      if (typeof saved.fontSize === "number" && saved.fontSize >= 16 && saved.fontSize <= 30)
        setFontSize(saved.fontSize);
      if (typeof saved.lineHeight === "number" && saved.lineHeight >= 1.45 && saved.lineHeight <= 2.2)
        setLineHeight(saved.lineHeight);
      if (typeof saved.readerWidth === "number" && saved.readerWidth >= 600 && saved.readerWidth <= 960)
        setReaderWidth(saved.readerWidth);
      if (READER_FONTS.some((font) => font.id === saved.fontFamily))
        setFontFamily(saved.fontFamily as ReaderFont);
      setSettingsLoaded(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!settingsLoaded) return;
    localStorage.setItem(
      "mocdoc-settings",
      JSON.stringify({ theme, fontSize, lineHeight, readerWidth, fontFamily }),
    );
  }, [theme, fontSize, lineHeight, readerWidth, fontFamily, settingsLoaded]);

  useEffect(() => {
    let frame = 0;
    const updateProgress = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const max = document.documentElement.scrollHeight - window.innerHeight;
        const next = max > 0 ? Math.min(100, (window.scrollY / max) * 100) : 0;
        setProgress(next);
        if (chapter) {
          localStorage.setItem(`mocdoc-progress:${chapter.key}`, String(next));
        }
      });
    };

    updateProgress();
    window.addEventListener("scroll", updateProgress, { passive: true });
    window.addEventListener("resize", updateProgress);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", updateProgress);
      window.removeEventListener("resize", updateProgress);
    };
  }, [chapter]);

  const openText = useCallback(
    (text: string, fileName: string, key: string, encoding = "UTF-8") => {
      const parsed = parseChapter(text, fileName);
      if (!parsed.paragraphs.length) {
        setError("File này chưa có nội dung để hiển thị.");
        return;
      }

      setError("");
      setChapter({ ...parsed, fileName, key, encoding });
      document.title = `${parsed.title} — Mộc Đọc`;

      const savedProgress = Number(
        localStorage.getItem(`mocdoc-progress:${key}`) || "0",
      );
      window.setTimeout(() => {
        const max = document.documentElement.scrollHeight - window.innerHeight;
        window.scrollTo({
          top: savedProgress > 1 ? (savedProgress / 100) * max : 0,
          behavior: "smooth",
        });
      }, 80);
    },
    [],
  );

  const loadFile = useCallback(
    async (file?: File) => {
      if (!file) return;
      if (!file.name.toLowerCase().endsWith(".txt")) {
        setError("Vui lòng chọn đúng file có đuôi .txt.");
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        setError("File lớn hơn 10 MB. Hãy chia nội dung thành từng chương nhỏ hơn.");
        return;
      }

      const buffer = await file.arrayBuffer();
      const decoded = decodeFile(buffer);
      openText(
        decoded.text,
        file.name,
        `${file.name}:${file.size}:${file.lastModified}`,
        decoded.encoding,
      );
    },
    [openText],
  );

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") return;
      if (event.key.toLowerCase() === "o") {
        event.preventDefault();
        fileInputRef.current?.click();
      }
      if (event.key === "]") setFontSize((size) => Math.min(30, size + 1));
      if (event.key === "[") setFontSize((size) => Math.max(16, size - 1));
      if (event.key.toLowerCase() === "t") {
        setTheme((current) =>
          current === "paper" ? "sepia" : current === "sepia" ? "night" : "paper",
        );
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  const stats = useMemo(() => {
    if (!chapter) return null;
    const words = chapter.paragraphs.join(" ").trim().split(/\s+/).length;
    return { words, minutes: Math.max(1, Math.ceil(words / 220)) };
  }, [chapter]);

  const readerStyle = {
    "--reader-font-size": `${fontSize}px`,
    "--reader-line-height": lineHeight,
    "--reader-width": `${readerWidth}px`,
  } as CSSProperties;

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
    void loadFile(event.dataTransfer.files[0]);
  };

  return (
    <div
      className={`app-shell theme-${theme} ${isDragging ? "is-dragging" : ""}`}
      onDragEnter={(event) => {
        event.preventDefault();
        setIsDragging(true);
      }}
      onDragOver={(event) => event.preventDefault()}
      onDragLeave={(event) => {
        if (event.currentTarget === event.target) setIsDragging(false);
      }}
      onDrop={onDrop}
    >
      <div className="reading-progress" style={{ width: `${progress}%` }} />
      <input
        ref={fileInputRef}
        className="visually-hidden"
        type="file"
        accept=".txt,text/plain"
        onChange={(event) => void loadFile(event.target.files?.[0])}
      />

      <header className="topbar">
        <button className="brand" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>
          <span className="brand-mark">M</span>
          <span>Mộc Đọc</span>
        </button>

        <div className="toolbar" aria-label="Tùy chỉnh trình đọc">
          <div className="theme-switcher" aria-label="Màu nền">
            {THEMES.map((item) => (
              <button
                key={item.id}
                className={theme === item.id ? "active" : ""}
                onClick={() => setTheme(item.id)}
                title={`Giao diện ${item.label}`}
                aria-label={`Giao diện ${item.label}`}
                aria-pressed={theme === item.id}
              >
                {item.swatch}
              </button>
            ))}
          </div>

          <span className="toolbar-divider" />
          <label className="font-picker" title="Font đọc truyện">
            <span className="visually-hidden">Font đọc truyện</span>
            <select
              value={fontFamily}
              onChange={(event) => setFontFamily(event.target.value as ReaderFont)}
              aria-label="Font đọc truyện"
            >
              {READER_FONTS.map((font) => (
                <option key={font.id} value={font.id}>{font.label}</option>
              ))}
            </select>
          </label>
          <button
            className="tool-button"
            onClick={() => setFontSize((size) => Math.max(16, size - 1))}
            title="Giảm cỡ chữ"
            aria-label="Giảm cỡ chữ"
          >
            A−
          </button>
          <span className="font-value">{fontSize}</span>
          <button
            className="tool-button"
            onClick={() => setFontSize((size) => Math.min(30, size + 1))}
            title="Tăng cỡ chữ"
            aria-label="Tăng cỡ chữ"
          >
            A+
          </button>
          <label className="range-control" title="Độ rộng trang đọc">
            <span>↔</span>
            <input
              type="range"
              min="600"
              max="960"
              step="40"
              value={readerWidth}
              onChange={(event) => setReaderWidth(Number(event.target.value))}
              aria-label="Độ rộng trang đọc"
            />
          </label>
          <label className="range-control line-range" title="Giãn dòng">
            <span>↕</span>
            <input
              type="range"
              min="1.45"
              max="2.2"
              step="0.05"
              value={lineHeight}
              onChange={(event) => setLineHeight(Number(event.target.value))}
              aria-label="Giãn dòng"
            />
          </label>
        </div>

        <button className="open-button" onClick={() => fileInputRef.current?.click()}>
          <span>＋</span> {chapter ? "Đổi file" : "Mở file"}
        </button>
      </header>

      {chapter ? (
        <main className="reader" style={readerStyle}>
          <section className="chapter-heading" aria-labelledby="chapter-title">
            <p className="eyebrow">Đang đọc</p>
            <h1 id="chapter-title">{chapter.title}</h1>
            <div className="chapter-meta">
              <span>{stats?.words.toLocaleString("vi-VN")} từ</span>
              <span className="meta-dot">•</span>
              <span>Khoảng {stats?.minutes} phút đọc</span>
              <span className="meta-dot">•</span>
              <span>{chapter.encoding}</span>
            </div>
          </section>

          <article className={`chapter-body font-${fontFamily}`}>
            {chapter.paragraphs.map((paragraph, index) => (
              <p key={`${index}-${paragraph.slice(0, 16)}`}>{paragraph}</p>
            ))}
          </article>

          <footer className="chapter-end">
            <span className="ornament">✦</span>
            <p>Hết chương</p>
            <button onClick={() => fileInputRef.current?.click()}>Mở chương tiếp theo</button>
          </footer>
        </main>
      ) : (
        <main className="welcome">
          <section className="welcome-copy">
            <p className="eyebrow">Một góc đọc thật yên</p>
            <h1>Đưa chương truyện<br />về đúng dáng của nó.</h1>
            <p className="intro">
              Thả file TXT vào đây. Mộc Đọc sẽ tự tách đoạn, nhận diện tiêu đề và
              dàn trang lại thành một trải nghiệm đọc thoải mái hơn.
            </p>
            <div className="privacy-note">
              <span className="privacy-icon">⌁</span>
              <div>
                <strong>Riêng tư ngay từ đầu</strong>
                <p>Nội dung được xử lý trên thiết bị này, không gửi đi đâu cả.</p>
              </div>
            </div>
          </section>

          <section
            className="drop-card"
            onClick={() => fileInputRef.current?.click()}
            role="button"
            tabIndex={0}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") fileInputRef.current?.click();
            }}
            aria-label="Chọn file TXT"
          >
            <div className="paper-stack" aria-hidden="true">
              <span className="paper-back" />
              <span className="paper-middle" />
              <span className="paper-front">
                <i />
                <i />
                <i />
                <b>TXT</b>
              </span>
            </div>
            <h2>Thả file TXT vào đây</h2>
            <p>hoặc bấm để chọn từ máy</p>
            <span className="file-limit">Tối đa 10 MB · UTF-8 / Windows-1258</span>
            {error && <div className="error-message">{error}</div>}
          </section>

          <button
            className="sample-button"
            onClick={() => openText(SAMPLE_TEXT, "chuong-mau.txt", "sample")}
          >
            Chưa có file? <span>Đọc thử một chương mẫu →</span>
          </button>
        </main>
      )}

      <div className="drop-overlay" aria-hidden={!isDragging}>
        <div>
          <span>↓</span>
          <strong>Thả file để bắt đầu đọc</strong>
          <p>Chỉ nhận file .txt</p>
        </div>
      </div>
    </div>
  );
}
