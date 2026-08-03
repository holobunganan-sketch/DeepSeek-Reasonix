package agent

// northwing_office exposes one ordinary path argument, so it can share the
// same write-claim extraction and parent reservation rules as write_file.
func init() {
	pathBoundWriterNames["northwing_office"] = true
}
