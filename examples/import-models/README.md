# Import-Beispielmodelle

Erstellt und mit `@ramen-suite/core` 0.1.0 über `RamenModel.import()` geprüft.
Die JSON-Dateien entsprechen dem RAMEN-Austauschformat, das Nori beim Projektimport einliest. Die absichtlich beschädigte Datei 06 verletzt dieses Format.

Das Referenzmodell beschreibt eine kleine Briefedition mit `Letter`, `Text` und `Person`, eigenen Properties und den Beziehungen `PART_OF`, `HAS_ANNOTATION` und `REFERS_TO`.
Jede fehlerhafte Variante wurde unabhängig vom gültigen Referenzmodell abgeleitet.

| Datei                        | Fall                                                                                                | Verhalten heute                                      | Ziel für einen Reparaturimport                                                                                                   |
| ---------------------------- | --------------------------------------------------------------------------------------------------- | ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `01-valid.json`              | Gültiges Referenzmodell                                                                             | Import erfolgreich                                   | Normal öffnen                                                                                                                    |
| `02-duplicate-property.json` | Auf `Text` heißen zwei Properties `text`                                                            | Import abgelehnt: doppelter Property-Name            | Öffnet das Modell mit Diagnosen; die doppelte Property kann umbenannt werden                                                     |
| `03-unknown-datatype.json`   | `Text.text` verweist auf einen nicht vorhandenen Datentyp                                           | Import abgelehnt: Referenz nicht gefunden            | Öffnet das Modell mit Diagnosen; der unbekannte Typ bleibt erhalten und kann durch einen Basistyp ersetzt werden                 |
| `04-invalid-refinement.json` | `Text` verfeinert `Person` statt `Content`; seine bestehenden Beziehungen passen dadurch nicht mehr | Import abgelehnt: erforderliche Verfeinerung fehlt   | Öffnet das Modell mit Diagnosen zur fehlerhaften Verfeinerung                                                                    |
| `05-missing-dependency.json` | Die RAMEN-Abhängigkeit fehlt, bleibt aber referenziert                                              | Import abgelehnt: importiertes Modell nicht gefunden | Öffnet das Modell und meldet die fehlende Abhängigkeit; keine stillschweigende Ersetzung. Nachladen ist noch nicht implementiert |
| `06-malformed-document.json` | `classifiers` ist ein Text statt einer Liste                                                        | Import abgelehnt: ungültige Dateistruktur            | Lehnt den Import mit Formatfehler ab                                                                                             |

## Ausprobieren

In Nori den Projektimport öffnen und jeweils eine der JSON-Dateien auswählen.
**Nori öffnet die Dateien 01–05.** Fachliche Fehler bleiben erhalten und erscheinen in der Modellprüfung. Datei 06 wird weiterhin abgelehnt. Der strikte Core-Import bleibt unverändert.

Mit `npm run test:import` lassen sich gültiger Roundtrip, Reparatur, Diagnosen und Ablehnungsfälle automatisiert prüfen. Nicht zuordenbare Deklarationen, doppelte Modellidentitäten, ein fehlendes Projektwurzelmodell und zyklische Modellimporte werden ebenfalls abgelehnt, damit beim Wiederherstellen nichts verloren geht.

Die Dateien enthalten jeweils dieselben Modell- und Elementidentitäten, damit die Änderungen vergleichbar bleiben; sie sind alternative Testfälle und nicht als gleichzeitig zusammenzuführende Modelle gedacht.
