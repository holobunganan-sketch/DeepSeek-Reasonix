package office

import (
	"archive/zip"
	"bytes"
	"encoding/xml"
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"
)

func ReplaceText(path, find, repl string) error {
	if find == "" {
		return errors.New("find is required")
	}
	ext := strings.ToLower(filepath.Ext(path))
	if ext != ".docx" && ext != ".pptx" && ext != ".xlsx" {
		return fmt.Errorf("replace_text supports DOCX, PPTX, and XLSX: %s", path)
	}
	files, err := readZip(path)
	if err != nil {
		return err
	}
	changed := false
	for name, data := range files {
		if strings.HasSuffix(strings.ToLower(name), ".xml") {
			before := string(data)
			after := strings.ReplaceAll(before, xmlEsc(find), xmlEsc(repl))
			if after != before {
				files[name] = []byte(after)
				changed = true
			}
		}
	}
	if !changed {
		return fmt.Errorf("text %q was not found in %s", find, path)
	}
	return writeZip(path, files)
}

func Inspect(path string) (Report, error) {
	info, err := os.Stat(path)
	if err != nil {
		return Report{}, err
	}
	r := Report{Path: filepath.ToSlash(path), Kind: strings.TrimPrefix(strings.ToLower(filepath.Ext(path)), "."), Size: info.Size()}
	if r.Kind == "pdf" {
		data, err := os.ReadFile(path)
		if err != nil {
			return r, err
		}
		if !bytes.HasPrefix(data, []byte("%PDF-")) || !bytes.Contains(data, []byte("%%EOF")) {
			return r, errors.New("invalid PDF header or trailer")
		}
		r.Pages = bytes.Count(data, []byte("/Type /Page "))
		r.Valid = r.Pages > 0
		if !r.Valid {
			return r, errors.New("PDF contains no pages")
		}
		return r, nil
	}
	if r.Kind != "docx" && r.Kind != "pptx" && r.Kind != "xlsx" {
		return r, fmt.Errorf("%w: %s", errUnsupported, path)
	}
	return inspectOOXML(path, r)
}

func inspectOOXML(path string, r Report) (Report, error) {
	zr, err := zip.OpenReader(path)
	if err != nil {
		return r, err
	}
	defer zr.Close()
	r.Entries = len(zr.File)
	names := map[string]bool{}
	var preview []string
	for _, f := range zr.File {
		names[f.Name] = true
		if !strings.HasSuffix(strings.ToLower(f.Name), ".xml") {
			continue
		}
		rd, err := f.Open()
		if err != nil {
			return r, err
		}
		data, err := io.ReadAll(io.LimitReader(rd, 8<<20))
		_ = rd.Close()
		if err != nil {
			return r, err
		}
		if err = validateXML(data); err != nil {
			return r, fmt.Errorf("invalid XML %s: %w", f.Name, err)
		}
		if strings.Contains(f.Name, "_rels") && bytes.Contains(data, []byte(`TargetMode="External"`)) {
			r.Warnings = append(r.Warnings, "external relationship: "+f.Name)
		}
		if len(preview) < 8 {
			preview = append(preview, extractTexts(data, 8-len(preview))...)
		}
	}
	required := []string{"[Content_Types].xml", "_rels/.rels"}
	switch r.Kind {
	case "docx":
		required = append(required, "word/document.xml")
		r.Paragraphs = countToken(zr.File, "word/document.xml", "<w:p")
	case "pptx":
		required = append(required, "ppt/presentation.xml")
		for n := range names {
			if strings.HasPrefix(n, "ppt/slides/slide") && strings.HasSuffix(n, ".xml") {
				r.Slides++
			}
		}
	case "xlsx":
		required = append(required, "xl/workbook.xml")
		for n := range names {
			if strings.HasPrefix(n, "xl/worksheets/sheet") && strings.HasSuffix(n, ".xml") {
				r.Sheets++
				r.Cells += countToken(zr.File, n, "<c ")
			}
		}
	}
	for _, n := range required {
		if !names[n] {
			return r, fmt.Errorf("Office package is missing %s", n)
		}
	}
	r.Preview = compactStrings(preview, 8)
	r.Valid = true
	return r, nil
}

func validateXML(data []byte) error {
	d := xml.NewDecoder(bytes.NewReader(data))
	for {
		_, err := d.Token()
		if err == io.EOF {
			return nil
		}
		if err != nil {
			return err
		}
	}
}

func extractTexts(data []byte, limit int) []string {
	d := xml.NewDecoder(bytes.NewReader(data))
	var out []string
	for len(out) < limit {
		tok, err := d.Token()
		if err != nil {
			break
		}
		s, ok := tok.(xml.StartElement)
		if !ok || (s.Name.Local != "t" && s.Name.Local != "v") {
			continue
		}
		var text string
		if d.DecodeElement(&text, &s) == nil && strings.TrimSpace(text) != "" {
			out = append(out, text)
		}
	}
	return out
}

func countToken(files []*zip.File, name, token string) int {
	for _, f := range files {
		if f.Name != name {
			continue
		}
		r, err := f.Open()
		if err != nil {
			return 0
		}
		data, _ := io.ReadAll(r)
		_ = r.Close()
		return strings.Count(string(data), token)
	}
	return 0
}
