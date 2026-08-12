"use client";

import * as React from "react";
import Editor, { loader, type OnMount } from "@monaco-editor/react";
import { Code2, Save, RotateCcw } from "lucide-react";
import * as SheetPrimitive from "@radix-ui/react-dialog";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

loader.config({
  paths: { vs: "https://cdn.jsdelivr.net/npm/monaco-editor@0.52.2/min/vs" },
});

export type CodeLanguage =
  | "css"
  | "javascript"
  | "typescript"
  | "html"
  | "json"
  | "python"
  | "java"
  | "c_cpp"
  | "ruby"
  | "php"
  | "sql"
  | "markdown"
  | "golang"
  | "rust"
  | "lua";

const ACE_TO_MONACO: Record<string, string> = {
  css: "css",
  javascript: "javascript",
  typescript: "typescript",
  html: "html",
  json: "json",
  python: "python",
  java: "java",
  c_cpp: "cpp",
  ruby: "ruby",
  php: "php",
  sql: "sql",
  markdown: "markdown",
  golang: "go",
  rust: "rust",
  lua: "lua",
};

interface LanguageOption {
  value: CodeLanguage;
  label: string;
  extension: string;
}

interface CodeEditorProps {
  className?: string;
  language?: CodeLanguage;
  value?: string;
  onChange?: (value: string) => void;
  onBlur?: () => void;
  onLoad?: (editor: any, monaco?: any) => void;
  placeholder?: string;
}

const LANGUAGE_OPTIONS: LanguageOption[] = [
  { value: "css", label: "CSS", extension: ".css" },
  { value: "javascript", label: "JavaScript", extension: ".js" },
  { value: "typescript", label: "TypeScript", extension: ".ts" },
  { value: "html", label: "HTML", extension: ".html" },
  { value: "json", label: "JSON", extension: ".json" },
  { value: "python", label: "Python", extension: ".py" },
  { value: "java", label: "Java", extension: ".java" },
  { value: "c_cpp", label: "C/C++", extension: ".cpp" },
  { value: "ruby", label: "Ruby", extension: ".rb" },
  { value: "php", label: "PHP", extension: ".php" },
  { value: "sql", label: "SQL", extension: ".sql" },
  { value: "markdown", label: "Markdown", extension: ".md" },
  { value: "golang", label: "Go", extension: ".go" },
  { value: "rust", label: "Rust", extension: ".rs" },
  { value: "lua", label: "Lua", extension: ".lua" },
];

const PLACEHOLDERS: Record<CodeLanguage, string> = {
  css: `/* Hello World in CSS */\n.hello-world {\n  color: blue;\n  font-size: 16px;\n}`,
  javascript: `// Hello World in JavaScript\nconsole.log("Hello, World!");`,
  typescript: `// Hello World in TypeScript\nconst message: string = "Hello, World!";\nconsole.log(message);`,
  html: `<!-- Hello World in HTML -->\n<h1>Hello, World!</h1>`,
  json: `{\n  "message": "Hello, World!"\n}`,
  python: `# Hello World in Python\nprint("Hello, World!")`,
  java: `// Hello World in Java\npublic class HelloWorld {\n    public static void main(String[] args) {\n        System.out.println("Hello, World!");\n    }\n}`,
  c_cpp: `// Hello World in C/C++\n#include <iostream>\nusing namespace std;\nint main() {\n    cout << "Hello, World!" << endl;\n    return 0;\n}`,
  ruby: `# Hello World in Ruby\nputs "Hello, World!"`,
  php: `<?php\n// Hello World in PHP\necho "Hello, World!";\n?>`,
  sql: `-- Hello World in SQL\nSELECT 'Hello, World!' AS message;`,
  markdown: `# Hello, World!\nWelcome to Markdown.`,
  golang: `// Hello World in Go\npackage main\nimport "fmt"\nfunc main() {\n    fmt.Println("Hello, World!")\n}`,
  rust: `// Hello World in Rust\nfn main() {\n    println!("Hello, World!");\n}`,
  lua: `-- Hello World in Lua\nprint("Hello, World!")`,
};

function useMonacoTheme() {
  const [isDark, setIsDark] = React.useState(() =>
    document.documentElement.classList.contains("dark")
  );

  React.useEffect(() => {
    const observer = new MutationObserver(() => {
      setIsDark(document.documentElement.classList.contains("dark"));
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
    return () => observer.disconnect();
  }, []);

  return isDark ? "vs-dark" : "vs";
}

function CodeEditorSheet({
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Root>) {
  return <SheetPrimitive.Root data-slot="code-editor-sheet" {...props} />;
}

function CodeEditorSheetTrigger({
  className,
  children = (
    <Button variant="outline" className="gap-2">
      <Code2 className="h-4 w-4" />
      Open Code Editor
    </Button>
  ),
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Trigger>) {
  return (
    <SheetPrimitive.Trigger
      data-slot="code-editor-sheet-trigger"
      className={cn(className)}
      asChild
      {...props}
    >
      {children}
    </SheetPrimitive.Trigger>
  );
}

function CodeEditorSheetContent({
  className,
  side = "right",
  children,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Content> & {
  side?: "top" | "right" | "bottom" | "left";
}) {
  return (
    <SheetPrimitive.Portal>
      <SheetPrimitive.Overlay
        data-slot="code-editor-sheet-overlay"
        className="data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-50 bg-black/50"
      />
      <SheetPrimitive.Content
        data-slot="code-editor-sheet-content"
        className={cn(
          "bg-background data-[state=open]:animate-in data-[state=closed]:animate-out fixed z-50 flex flex-col shadow-lg transition ease-in-out data-[state=closed]:duration-300 data-[state=open]:duration-500",
          side === "right" &&
            "data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right inset-y-0 right-0 h-full w-full border-l sm:max-w-[800px]",
          className
        )}
        {...props}
      >
        {children}
      </SheetPrimitive.Content>
    </SheetPrimitive.Portal>
  );
}

function CodeEditorSheetHeader({
  className,
  title = "Code Editor",
  description = "Write and edit your custom code",
  language,
  ...props
}: React.ComponentProps<"div"> & {
  title?: string;
  description?: string;
  language?: CodeLanguage;
}) {
  const selectedLanguage = LANGUAGE_OPTIONS.find(
    (opt) => opt.value === language
  );
  return (
    <div
      data-slot="code-editor-sheet-header"
      className={cn("px-6 py-4 border-b", className)}
      {...props}
    >
      <div className="flex items-center justify-between">
        <div>
          <SheetPrimitive.Title
            data-slot="code-editor-sheet-title"
            className="flex items-center gap-2 text-foreground font-semibold"
          >
            <Code2 className="h-5 w-5" />
            {title}
          </SheetPrimitive.Title>
          <SheetPrimitive.Description
            data-slot="code-editor-sheet-description"
            className="mt-1 text-muted-foreground text-sm"
          >
            {description}
          </SheetPrimitive.Description>
        </div>
        {selectedLanguage && (
          <Badge variant="secondary" className="ml-2">
            {selectedLanguage.extension}
          </Badge>
        )}
      </div>
    </div>
  );
}

function CodeEditorSheetControls({
  className,
  language,
  allowLanguageChange = false,
  onLanguageChange,
  onReset,
  onSave,
  ...props
}: React.ComponentProps<"div"> & {
  language: CodeLanguage;
  allowLanguageChange?: boolean;
  onLanguageChange?: (value: CodeLanguage) => void;
  onReset?: () => void;
  onSave?: () => void;
}) {
  return (
    <div
      data-slot="code-editor-sheet-controls"
      className={cn("px-6 py-3 border-b", className)}
      {...props}
    >
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          {allowLanguageChange && onLanguageChange ? (
            <Select value={language} onValueChange={onLanguageChange}>
              <SelectTrigger className="w-[140px] h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LANGUAGE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <div className="border border-input bg-muted rounded-md px-2 py-1 uppercase text-sm">
              {language}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          {onReset && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onReset}
              className="h-8 px-3"
            >
              <RotateCcw className="h-3 w-3 mr-1" />
              Reset
            </Button>
          )}
          {onSave && (
            <Button onClick={onSave} size="sm" className="h-8 px-3">
              <Save className="h-3 w-3 mr-1" />
              Save
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function CodeEditor({
  className,
  language = "css",
  value = "",
  onChange,
  onBlur,
  onLoad,
  placeholder,
}: CodeEditorProps) {
  const theme = useMonacoTheme();
  const editorRef = React.useRef<any>(null);

  const handleMount: OnMount = React.useCallback(
    (editor, monaco) => {
      editorRef.current = editor;

      monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions({
        noSemanticValidation: true,
        noSyntaxValidation: true,
        noSuggestionDiagnostics: true,
      });
      monaco.languages.typescript.javascriptDefaults.setDiagnosticsOptions({
        noSemanticValidation: true,
        noSyntaxValidation: true,
        noSuggestionDiagnostics: true,
      });

      if (placeholder && !value) {
        const model = editor.getModel();
        if (model) {
          monaco.editor.setModelLanguage(model, ACE_TO_MONACO[language] || language);
        }
      }

      (editor as any).undo = () => editor.trigger("keyboard", "undo", null);
      (editor as any).redo = () => editor.trigger("keyboard", "redo", null);
      (editor as any).getSession = () => ({
        getUndoManager: () => ({
          reset: () => {
            const model = editor.getModel();
            if (model) {
              (model as any)._commandManager?.clear?.();
            }
          },
        }),
      });

      onLoad?.(editor, monaco);
      requestAnimationFrame(() => editor.layout());
    },
    [onLoad, placeholder, value, language]
  );

  const monacoLanguage = ACE_TO_MONACO[language] || language;

  return (
    <div
      data-slot="code-editor"
      className={cn("flex-1 relative min-h-0", className)}
    >
      <Editor
        language={monacoLanguage}
        value={value}
        theme={theme}
        onChange={(val) => onChange?.(val || "")}
        onMount={handleMount}
        loading={
          <div className="flex items-center justify-center h-full">
            <span className="text-sm" style={{ color: "var(--text-500)" }}>
              Loading editor...
            </span>
          </div>
        }
        options={{
          fontSize: 14,
          fontFamily:
            "'JetBrains Mono', 'Fira Code', 'Monaco', 'Menlo', 'Ubuntu Mono', monospace",
          fontLigatures: true,
          lineNumbers: "on",
          minimap: { enabled: false },
          scrollBeyondLastLine: false,
          wordWrap: "on",
          tabSize: 2,
          automaticLayout: true,
          padding: { top: 8, bottom: 8 },
          suggest: {
            showKeywords: true,
            showSnippets: true,
          },
          quickSuggestions: true,
          bracketPairColorization: { enabled: true },
          smoothScrolling: true,
          cursorSmoothCaretAnimation: "on",
          renderLineHighlight: "all",
          folding: true,
          links: true,
        }}
      />
    </div>
  );
}

interface CodeEditorSheetComposedProps {
  trigger?: React.ReactNode;
  title?: string;
  description?: string;
  defaultLanguage?: CodeLanguage;
  allowLanguageChange?: boolean;
  defaultValue?: string;
  onSave?: (code: string, language: CodeLanguage) => void;
  onReset?: () => void;
  placeholder?: string;
}

function CodeEditorSheetComposed({
  trigger,
  title,
  description,
  defaultLanguage = "css",
  allowLanguageChange = false,
  defaultValue = "",
  onSave,
  onReset,
  placeholder,
}: CodeEditorSheetComposedProps) {
  const [language, setLanguage] = React.useState<CodeLanguage>(defaultLanguage);
  const [code, setCode] = React.useState<string>(defaultValue);

  const handleSave = () => {
    onSave?.(code, language);
  };

  const handleReset = () => {
    setCode(defaultValue);
    onReset?.();
  };

  return (
    <CodeEditorSheet>
      <CodeEditorSheetTrigger>{trigger}</CodeEditorSheetTrigger>
      <CodeEditorSheetContent>
        <CodeEditorSheetHeader
          title={title}
          description={description}
          language={language}
        />
        <CodeEditorSheetControls
          language={language}
          allowLanguageChange={allowLanguageChange}
          onLanguageChange={setLanguage}
          onReset={handleReset}
          onSave={handleSave}
        />
        <CodeEditor
          language={language}
          value={code}
          onChange={setCode}
          placeholder={placeholder}
        />
      </CodeEditorSheetContent>
    </CodeEditorSheet>
  );
}

export {
  CodeEditorSheet,
  CodeEditorSheetTrigger,
  CodeEditorSheetContent,
  CodeEditorSheetHeader,
  CodeEditorSheetControls,
  CodeEditor,
  CodeEditorSheetComposed,
};
