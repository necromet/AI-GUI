export interface ArcadeToolDefinition {
  id: string;
  name: string;
  tool: string;
  description: string;
  inputs: Array<{ name: string; type: 'string' | 'array'; required: boolean }>;
}

export const ARCADE_TOOLS: ArcadeToolDefinition[] = [
  { id: 'google-docs-create', name: 'Create Google Doc', tool: 'GoogleDocs.CreateDocumentFromText@4.3.1', description: 'Create a Google Doc from text.', inputs: [{ name: 'title', type: 'string', required: true }, { name: 'text_content', type: 'string', required: true }] },
  { id: 'google-sheets-create', name: 'Create Google Sheet', tool: 'GoogleSheets.CreateSpreadsheet@4.3.1', description: 'Create a spreadsheet from rows.', inputs: [{ name: 'title', type: 'string', required: true }, { name: 'data', type: 'array', required: true }] },
  { id: 'google-slides-create', name: 'Create Google Slides', tool: 'GoogleSlides.CreatePresentation@4.3.1', description: 'Create a presentation.', inputs: [{ name: 'title', type: 'string', required: true }, { name: 'slides', type: 'array', required: true }] },
  { id: 'gmail-send', name: 'Send Gmail', tool: 'Gmail.SendEmail@4.3.1', description: 'Send an email through Gmail.', inputs: [{ name: 'to', type: 'string', required: true }, { name: 'subject', type: 'string', required: true }, { name: 'body', type: 'string', required: true }] },
  { id: 'slack-send', name: 'Send Slack Message', tool: 'Slack.SendMessage@4.3.1', description: 'Send a Slack channel message.', inputs: [{ name: 'channel', type: 'string', required: true }, { name: 'message', type: 'string', required: true }] },
  { id: 'notion-create-page', name: 'Create Notion Page', tool: 'Notion.CreatePage@4.3.1', description: 'Create a Notion page.', inputs: [{ name: 'title', type: 'string', required: true }, { name: 'content', type: 'string', required: true }, { name: 'parent_page_id', type: 'string', required: false }] },
];
