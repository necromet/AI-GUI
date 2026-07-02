import * as React from "react";
import { Code2, Edit } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CodeEditorSheetComposed } from "@/components/ui/code-editor-sheet";

export default function CodeEditorDemo() {
  return (
    <div className="w-full max-w-7xl mx-auto px-4 py-12">
      <div className="text-center my-12">
        <h1 className="text-4xl font-extrabold text-foreground tracking-tight">
          Code Editor Sheet
        </h1>
        <p className="text-lg text-muted-foreground mt-4 max-w-3xl mx-auto">
          Multi-language code editor powered by Ace Editor, delivered in a
          slide-over sheet built on Radix UI.
        </p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        <Card className="flex flex-col shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg font-semibold">Multi-language Editor</CardTitle>
            <CardDescription className="text-sm">Switch between all supported languages</CardDescription>
          </CardHeader>
          <CardContent className="flex-1 flex items-center justify-center p-4">
            <CodeEditorSheetComposed
              trigger={
                <Button variant="outline" className="gap-2 w-full">
                  <Code2 className="h-4 w-4" />
                  Multi-language Editor
                </Button>
              }
              title="Multi-language Editor"
              description="Switch between all supported languages"
              defaultLanguage="html"
              allowLanguageChange={true}
              defaultValue={`<!-- Hello World in HTML -->\n<h1>Hello, World!</h1>`}
              onSave={(code, lang) => console.log(`Saved ${lang} code:`, code)}
            />
          </CardContent>
        </Card>

        <Card className="flex flex-col shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg font-semibold">CSS Editor</CardTitle>
            <CardDescription className="text-sm">Style your web content</CardDescription>
          </CardHeader>
          <CardContent className="flex-1 flex items-center justify-center p-4">
            <CodeEditorSheetComposed
              trigger={
                <Button variant="outline" className="gap-2 w-full">
                  <Code2 className="h-4 w-4" />
                  Write CSS
                </Button>
              }
              title="CSS Editor"
              description="Style your web content"
              defaultLanguage="css"
              defaultValue={`/* Hello World in CSS */\n.hello-world {\n  color: blue;\n  font-size: 16px;\n}`}
              onSave={(code) => console.log("Saved CSS:", code)}
            />
          </CardContent>
        </Card>

        <Card className="flex flex-col shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg font-semibold">JavaScript Editor</CardTitle>
            <CardDescription className="text-sm">Add interactivity to your web apps</CardDescription>
          </CardHeader>
          <CardContent className="flex-1 flex items-center justify-center p-4">
            <CodeEditorSheetComposed
              trigger={
                <Button variant="default" className="gap-2 w-full">
                  <Edit className="h-4 w-4" />
                  Edit JavaScript
                </Button>
              }
              title="JavaScript Editor"
              description="Add interactivity to your web apps"
              defaultLanguage="javascript"
              defaultValue={`// Hello World in JavaScript\nconsole.log("Hello, World!");`}
              onSave={(code) => console.log("Saved JS:", code)}
            />
          </CardContent>
        </Card>

        <Card className="flex flex-col shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg font-semibold">Python Editor</CardTitle>
            <CardDescription className="text-sm">Script with Python</CardDescription>
          </CardHeader>
          <CardContent className="flex-1 flex items-center justify-center p-4">
            <CodeEditorSheetComposed
              trigger={
                <Button variant="outline" className="gap-2 w-full">
                  <Code2 className="h-4 w-4" />
                  Python Script
                </Button>
              }
              title="Python Editor"
              description="Script with Python"
              defaultLanguage="python"
              defaultValue={`# Hello World in Python\nprint("Hello World!")`}
              onSave={(code) => console.log("Saved Python:", code)}
            />
          </CardContent>
        </Card>

        <Card className="flex flex-col shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg font-semibold">JSON Editor</CardTitle>
            <CardDescription className="text-sm">Manage data configurations</CardDescription>
          </CardHeader>
          <CardContent className="flex-1 flex items-center justify-center p-4">
            <CodeEditorSheetComposed
              trigger={
                <Button variant="ghost" className="gap-2 w-full">
                  <Code2 className="h-4 w-4" />
                  JSON Config
                </Button>
              }
              title="JSON Editor"
              description="Manage data configurations"
              defaultLanguage="json"
              defaultValue={`{\n  "message": "Hello, World!"\n}`}
              onSave={(code) => console.log("Saved JSON:", code)}
            />
          </CardContent>
        </Card>

        <Card className="flex flex-col shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg font-semibold">SQL Editor</CardTitle>
            <CardDescription className="text-sm">Query databases</CardDescription>
          </CardHeader>
          <CardContent className="flex-1 flex items-center justify-center p-4">
            <CodeEditorSheetComposed
              trigger={
                <Button variant="secondary" className="gap-2 w-full">
                  <Code2 className="h-4 w-4" />
                  SQL Query
                </Button>
              }
              title="SQL Editor"
              description="Query databases"
              defaultLanguage="sql"
              defaultValue={`-- Hello World in SQL\nSELECT 'Hello, World!' AS message;`}
              onSave={(code) => console.log("Saved SQL:", code)}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
