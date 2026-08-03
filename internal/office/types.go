package office

import (
	"errors"
	"fmt"
	"path/filepath"
	"strings"
)

type Section struct {
	Heading    string   `json:"heading,omitempty"`
	Paragraphs []string `json:"paragraphs,omitempty"`
}

type Slide struct {
	Title   string   `json:"title,omitempty"`
	Bullets []string `json:"bullets,omitempty"`
}

type Sheet struct {
	Name string  `json:"name,omitempty"`
	Rows [][]any `json:"rows,omitempty"`
}

type Request struct {
	Action   string    `json:"action"`
	Path     string    `json:"path"`
	Title    string    `json:"title,omitempty"`
	Text     string    `json:"text,omitempty"`
	Sections []Section `json:"sections,omitempty"`
	Slides   []Slide   `json:"slides,omitempty"`
	Sheets   []Sheet   `json:"sheets,omitempty"`
	Find     string    `json:"find,omitempty"`
	Replace  string    `json:"replace,omitempty"`
}

type Report struct {
	Path       string   `json:"path"`
	Kind       string   `json:"kind"`
	Valid      bool     `json:"valid"`
	Size       int64    `json:"size"`
	Pages      int      `json:"pages,omitempty"`
	Slides     int      `json:"slides,omitempty"`
	Sheets     int      `json:"sheets,omitempty"`
	Paragraphs int      `json:"paragraphs,omitempty"`
	Cells      int      `json:"cells,omitempty"`
	Entries    int      `json:"entries,omitempty"`
	Preview    []string `json:"preview,omitempty"`
	Warnings   []string `json:"warnings,omitempty"`
}

var errUnsupported = errors.New("unsupported Northwing Office action or file type")

func Execute(req Request) (Report, error) {
	req.Action = strings.ToLower(strings.TrimSpace(req.Action))
	req.Path = filepath.Clean(strings.TrimSpace(req.Path))
	if req.Path == "." || req.Path == "" {
		return Report{}, errors.New("path is required")
	}
	var err error
	switch req.Action {
	case "create_docx":
		err = CreateDOCX(req.Path, req.Title, req.Sections, req.Text)
	case "create_pptx":
		err = CreatePPTX(req.Path, req.Title, req.Slides)
	case "create_xlsx":
		err = CreateXLSX(req.Path, req.Sheets)
	case "create_pdf":
		err = CreatePDF(req.Path, req.Title, req.Text)
	case "replace_text":
		err = ReplaceText(req.Path, req.Find, req.Replace)
	case "inspect", "validate":
		return Inspect(req.Path)
	default:
		return Report{}, fmt.Errorf("%w: %s", errUnsupported, req.Action)
	}
	if err != nil {
		return Report{}, err
	}
	return Inspect(req.Path)
}
