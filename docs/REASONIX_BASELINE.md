# Reasonix Baseline

Northwing is an independent product built from a frozen Reasonix kernel baseline.

- Upstream source repository: <https://github.com/esengine/DeepSeek-Reasonix>
- Northwing fork: <https://github.com/holobunganan-sketch/DeepSeek-Reasonix>
- Frozen Northwing baseline commit: `b1f9471da9b7bceb0566f46f45d695c8fc9bae34`
- Product owner: Northwing
- Northwing release prefix: `northwing-v*`
- Northwing update source: Northwing releases only

## Upstream intake policy

Reasonix changes are not synchronized, rebased, merged, packaged, or distributed automatically. A future Reasonix change may enter Northwing only through an explicit Northwing branch and pull request, with a documented rationale and the complete Northwing test, migration, packaging, and update gates.

Northwing retains the applicable source license and third-party notices. Internal package names inherited from the frozen kernel do not create an update or release dependency on Reasonix.

The SignPath configuration inherited under `.signpath/` is bound to the
upstream `esengine/DeepSeek-Reasonix` project. It does not grant Northwing access
to the upstream signing organization, certificate, token, project, or approval
policy. Northwing's signing boundary is documented separately in the
[Northwing Code Signing Policy](./NORTHWING_CODE_SIGNING_POLICY.md).
