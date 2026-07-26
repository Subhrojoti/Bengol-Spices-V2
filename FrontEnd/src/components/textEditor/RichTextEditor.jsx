import {
  Editor,
  EditorProvider,
  Toolbar,
  BtnBold,
  BtnItalic,
  BtnUnderline,
  BtnBulletList,
  BtnNumberedList,
  BtnUndo,
  BtnRedo,
  BtnLink,
  BtnClearFormatting,
} from "react-simple-wysiwyg";

const RichTextEditor = ({ value, onChange }) => {
  return (
    <div className="border border-slate-300 rounded-lg overflow-hidden bg-white">
      <EditorProvider>
        <Toolbar className="bg-slate-50 border-b border-slate-200 flex flex-wrap gap-2 p-2">
          <BtnBold />
          <BtnItalic />
          <BtnUnderline />
          <BtnBulletList />
          <BtnNumberedList />
          <BtnLink />
          <BtnUndo />
          <BtnRedo />
          <BtnClearFormatting />
        </Toolbar>

        <Editor
          value={value}
          onChange={(e) => onChange(e.target.value)}
          containerProps={{
            className:
              "min-h-[180px] p-4 text-sm text-slate-700 focus:outline-none",
          }}
        />
      </EditorProvider>
    </div>
  );
};

export default RichTextEditor;
