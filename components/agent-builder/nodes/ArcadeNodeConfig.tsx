import { FIELD_STYLES, fieldClasses } from '../shared/formStyles';
import VariableAutocomplete from '../VariableAutocomplete';
import { ARCADE_TOOLS } from '../../../lib/workflow/arcadeTools';
import { ThemedSelect, ThemedSelectContent, ThemedSelectItem, ThemedSelectTrigger, ThemedSelectValue } from '../shared/ThemedSelect';

interface Props {
  data: Record<string, any>;
  onUpdate: (data: Record<string, any>) => void;
  upstreamNodes?: { id: string; label: string }[];
}

export default function ArcadeNodeConfig({ data, onUpdate, upstreamNodes = [] }: Props) {
  const inputText = typeof data.arcadeInput === 'string'
    ? data.arcadeInput
    : JSON.stringify(data.arcadeInput || {}, null, 2);
  const selectedDefinition = ARCADE_TOOLS.find(tool => tool.tool === data.arcadeTool);

  return (
    <div className="space-y-4">
      <div>
        <label className={fieldClasses.label} style={FIELD_STYLES.label}>Arcade action</label>
        <ThemedSelect value={data.arcadeTool || ''} onValueChange={value => onUpdate({ arcadeTool: value, arcadeInput: {} })}>
          <ThemedSelectTrigger><ThemedSelectValue placeholder="Select an action" /></ThemedSelectTrigger>
          <ThemedSelectContent>{ARCADE_TOOLS.map(tool => <ThemedSelectItem key={tool.id} value={tool.tool}>{tool.name}</ThemedSelectItem>)}</ThemedSelectContent>
        </ThemedSelect>
        {selectedDefinition && <p className="mt-1 text-[10px]" style={{ color: 'var(--text-500)' }}>{selectedDefinition.description}</p>}
      </div>
      <div>
        <label className={fieldClasses.label} style={FIELD_STYLES.label}>Arcade user ID</label>
        <VariableAutocomplete
          value={data.arcadeUserId || 'workflow-builder'}
          onChange={value => onUpdate({ arcadeUserId: value })}
          placeholder="{{input.user_id}}"
          upstreamNodes={upstreamNodes}
        />
      </div>
      {selectedDefinition ? <div className="space-y-3">
        {selectedDefinition.inputs.map(input => <div key={input.name}><label className={fieldClasses.label} style={FIELD_STYLES.label}>{input.name}{input.required ? ' *' : ''}</label><VariableAutocomplete value={typeof data.arcadeInput?.[input.name] === 'string' ? data.arcadeInput[input.name] : JSON.stringify(data.arcadeInput?.[input.name] ?? '')} onChange={value => onUpdate({ arcadeInput: { ...(data.arcadeInput || {}), [input.name]: input.type === 'array' ? (() => { try { return JSON.parse(value); } catch { return value; } })() : value } })} placeholder={input.type === 'array' ? '[]' : `{{${input.name}}}`} upstreamNodes={upstreamNodes} multiline={input.name === 'body' || input.name === 'content' || input.name === 'text_content'} /></div>)}
      </div> : <div>
        <label className={fieldClasses.label} style={FIELD_STYLES.label}>Tool input (JSON)</label>
        <VariableAutocomplete
          value={data.arcadeInputDraft ?? inputText}
          onChange={value => {
            try { onUpdate({ arcadeInput: JSON.parse(value), arcadeInputDraft: undefined }); }
            catch { onUpdate({ arcadeInputDraft: value }); }
          }}
          multiline
          rows={8}
          upstreamNodes={upstreamNodes}
        />
        {data.arcadeInputDraft && <p className="mt-1 text-[10px] text-red-400">Enter valid JSON before running.</p>}
      </div>}
      <p className="text-[10px]" style={{ color: 'var(--text-500)' }}>
        Arcade actions pause when authorization is required and resume after approval.
      </p>
    </div>
  );
}
