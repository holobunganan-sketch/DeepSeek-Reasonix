package office

import (
	"bytes"
	"os"
	"path/filepath"
	"testing"
)

func TestCreateInspectAndReplace(t *testing.T) {
	dir := t.TempDir()
	cases := []Request{
		{Action: "create_docx", Path: filepath.Join(dir, "a.docx"), Title: "标题", Sections: []Section{{Heading: "摘要", Paragraphs: []string{"正文"}}}},
		{Action: "create_pptx", Path: filepath.Join(dir, "a.pptx"), Slides: []Slide{{Title: "页一", Bullets: []string{"要点"}}}},
		{Action: "create_xlsx", Path: filepath.Join(dir, "a.xlsx"), Sheets: []Sheet{{Name: "数据", Rows: [][]any{{"名称", "值"}, {"A", 1}}}}},
		{Action: "create_pdf", Path: filepath.Join(dir, "a.pdf"), Title: "报告", Text: "中文正文"},
	}
	for _, req := range cases {
		r, err := Execute(req)
		if err != nil || !r.Valid {
			t.Fatalf("%s: report=%+v err=%v", req.Action, r, err)
		}
	}
	if err := ReplaceText(cases[0].Path, "正文", "修改"); err != nil {
		t.Fatal(err)
	}
	r, err := Inspect(cases[0].Path)
	if err != nil || len(r.Preview) == 0 {
		t.Fatalf("inspect replaced: %+v %v", r, err)
	}
}

func TestDeterministicXLSX(t *testing.T) {
	dir := t.TempDir()
	a := filepath.Join(dir, "a.xlsx")
	b := filepath.Join(dir, "b.xlsx")
	s := []Sheet{{Rows: [][]any{{"a", 1}}}}
	if err := CreateXLSX(a, s); err != nil {
		t.Fatal(err)
	}
	if err := CreateXLSX(b, s); err != nil {
		t.Fatal(err)
	}
	aa, _ := os.ReadFile(a)
	bb, _ := os.ReadFile(b)
	if !bytes.Equal(aa, bb) {
		t.Fatal("identical input produced different package bytes")
	}
}
