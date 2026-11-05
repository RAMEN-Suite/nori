# Nori: Briefing für Node-Editor-Mockups

## Auftrag

Ich möchte den Node-Editor von Nori weiterentwickeln. Mach dafür konkrete Mockups, die sich wie ein Teil unserer bestehenden App anfühlen. Ich brauche eine übersichtliche Arbeitsfläche, von der aus man gezielt in die Bearbeitung kommt. Nicht direkt alle Einstellungen gleichzeitig anzeigen.

Gehe von der aktuellen Oberfläche aus. Entwirf die Anordnung und die Interaktionen, keine neue Designsprache und keine neuen Modellierungsfunktionen. Die Screenshots der aktuellen App sind die visuelle Referenz. Falls du Zugriff aufs Repository hast, lies `docs/ui-guidelines.md` und `docs/features.md`.

## Aktueller Stand und Richtung

Der Node-Editor ist eine eigene Bearbeitungsansicht innerhalb des geöffneten Projekts. Er ist kein großes Modal mehr. Beim Schließen kommt man zum vorherigen Haupteditor zurück; dessen Graphansicht bleibt erhalten.

Der aktuelle Versuch ordnet die Ansicht so an:

- Über der rechten Bearbeitungsfläche eine kompakte Leiste mit **Properties**, **Relationships**, **Constraints** und Schließen.
- Rechts die breite Bearbeitungsfläche, aktuell vor allem die Property-Liste. Eine zusätzliche Menüspalte gibt es in diesem Versuch nicht.
- Links eine schmalere Spalte mit Knotenkarte und darunter dem navigierbaren Model graph als getrennte Flächen.

**Dieser Versuch ist der Ausgangspunkt, noch kein endgültig akzeptiertes Layout.** Die genaue Gruppierung von Knotenkontext und Menü ist noch offen. Das Raster muss nicht unverändert bleiben, aber verliere den Bezug zu dieser Oberfläche nicht.

Diese Versuche haben bisher nicht überzeugt:

- Knotenname, Stift, „Refines“ und Typ-Chip zusammengequetscht in einer Kopfzeile.
- Die Knotenkarte allein oben im Graphen, auch als Box in einer Box. Der aktuelle erneute Versuch fasst dort zusätzlich das Menü zusammen und entfernt dafür die linke Spalte.
- Ein großes zentriertes Button-Menü im oberen Panel mit einer zusätzlichen Constraint-Liste unter dem verkleinerten Graphen.
- Ein kompletter visueller Neustart, der sich vom restlichen Nori entfernt.

Das ist Feedback zu den getesteten Ausführungen, kein grundsätzliches Verbot anderer Lösungen. Zeige aber gezielt, welches Problem eine Abweichung löst.

## Was im Editor möglich sein muss

### 1. Knoten erkennen und bearbeiten

Es muss jederzeit klar sein, welchen Knoten ich gerade bearbeite.

- Knotenname und übergeordneten Typ erkennen.
- Name und optionale Beschreibung gemeinsam über den vorhandenen Bearbeitungsdialog ändern. Die Beschreibung ist sekundär und muss nicht dauerhaft viel Platz einnehmen.
- Name auch direkt bearbeiten können; dabei den bestehenden Inline-Ansatz berücksichtigen.
- Zum übergeordneten Knoten beziehungsweise zur Quelle einer geerbten Definition wechseln.
- Duplizieren, Verfeinern und Löschen kontextbezogen erreichen. Diese Aktionen müssen nicht alle dauerhaft als Buttons sichtbar sein.
- Eigene und importierte beziehungsweise geerbte Definitionen unterscheiden. Importierte Definitionen sind im aktuellen Modell schreibgeschützt.

Keine neue Übersichtsseite voller Zähler und keine dekorative Beschreibungskarte als Standardinhalt.

### 2. Properties schnell bearbeiten

Die Liste ist ein zentraler Arbeitsbereich. Sie soll ordentlich und gut bedienbar sein, ohne wie eine große Datentabelle auszusehen.

Eine eigene Property-Zeile enthält:

- Einen direkt bearbeitbaren Namen.
- Einen Datentyp als Autocomplete, nicht als riesiges Select.
- Einen kompakten, umschaltbaren Icon-Button für mehrere Werte, mit verständlichem Tooltip.
- Einen Drag-Griff zum Sortieren.
- Kontextbezogene Aktionen für Details, Duplizieren und Löschen.

Der Name bekommt mehr Platz als der Datentyp. Vor den rechten Aktionen braucht es etwas Luft. Alle Zeilen, auch die neue Zeile, folgen denselben Spalten und Abständen. Hover und Fokus innerhalb der Zeile heben die gesamte Zeile hervor. Keine auffälligen Tabellen-Gitterlinien.

Am Ende steht immer eine leere Zeile zum Anlegen einer Property. Kein großer „Create property“-Button und kein zusätzlicher „No properties yet“-Block. Enter kann die neue Property anlegen.

Es gibt zwei unabhängig zuklappbare Gruppen:

- **Inherited properties**: alle geerbten Properties zusammen, unabhängig von ihrem Herkunftsmodell.
- **From [Modellname]**, zum Beispiel **From Antje Brons**: die eigenen Properties.

Geerbte Properties werden angesehen, nicht direkt verändert. Ihre Aktionen sind **View** mit Auge und danach **Go to source**. Gruppenüberschriften sind bündig; die Zeilen darunter sind sinnvoll eingerückt.

Die Details öffnen sich in einem normalen Nori-Dialog. Dort liegen Beschreibung, Pflichtwert, minimale/maximale Anzahl, Reihenfolge, wiederholte Werte, Schreibschutz und Identifier. Nicht jede dieser Einstellungen gehört in die schnelle Liste.

### 3. Constraints verstehen

Das aktuelle linke Menü enthält **Constraints**. Berücksichtige diesen Bereich im Entwurf.

Constraints haben einen Besitzer: Knoten, Property, Beziehung beziehungsweise Endpunkt oder Annotationstyp. Es muss erkennbar sein, worauf eine Regel wirkt und ob sie geerbt ist.

Aktuell kann Nori Property-Regeln in den Property-Details bearbeiten und vorhandene Knoten-Constraints einschließlich geerbter Regeln anzeigen. Einen allgemeinen Editor für eigene Constraint-Ausdrücke gibt es noch nicht. Erfinde dafür keine fertigen Code-Editoren, Ausdruckssprachen oder funktionslosen Einstellmöglichkeiten.

Offen ist die sinnvolle Aufgabe des Constraints-Bereichs: Übersicht und Zugang zu Regeln, ohne dieselben Einstellungen an mehreren Stellen widersprüchlich zu duplizieren.

### 4. Knoten und Beziehungen im Graphen auswählen

Der Graph ist Orientierung und Navigation, nicht nur ein Vorschaubild.

Bereits vorhanden sind Nachbarknoten-Navigation, Back/Forward, Pan, Zoom und Fit. Beim Wechsel des Knotens folgen dessen Kontext und Bearbeitungsinhalt.

**Zusätzlich zu entwerfen ist die Beziehungsauswahl innerhalb dieses Editors.** Der kleine Graph bietet dafür aktuell noch keine vollständige Bearbeitung.

Das Mockup muss unterscheiden zwischen:

- Dem Knoten, dessen Editor geöffnet ist.
- Einer ausgewählten Property dieses Knotens.
- Einer ausgewählten Beziehung zu einem anderen Knoten.
- Dem tatsächlichen Wechsel in den Editor eines anderen Knotens.

Wenn ich eine Beziehung auswähle, darf nicht ungefragt der bearbeitete Knoten wechseln. Zeige, wo die Beziehungsdetails erscheinen und wie ich wieder zur Knotenbearbeitung komme.

Beziehungsdetails müssen Typ/Name, Richtung, Quelle, Ziel, Beschreibung, Kardinalitäten und vorhandene Regeln verständlich darstellen können. Die Endknoten müssen erreichbar sein. Beziehungen sollten auch ohne präzisen Klick auf eine dünne Graphkante auffindbar sein, etwa über eine zugehörige Liste.

Vorhandene Workflows aus dem Haupteditor sind Beziehungserstellung zwischen zulässigen Knoten und Löschen mit Bestätigung. Wenn du ihren Zugang im Node-Editor zeigst, kennzeichne das als Erweiterung. Erfinde keine frei erlaubten Typ- oder Endpunktänderungen; die Zulässigkeit bestimmt das Modell.

### 5. Annotationen richtig einordnen

Properties, Relationships und Constraints sind immer im Menü sichtbar. Annotations erscheint beim Annotation-Basisknoten und seinen Refinements, wenn die Annotation-Bearbeitung aktiviert ist.

Ein Knoten, der „Annotation“ heißt oder Annotation verfeinert, bleibt trotzdem ein normal bearbeitbarer Knoten. Das ist von den einzelnen Annotationstypen/Shapes zu unterscheiden.

Die vorhandenen Annotationsfunktionen dürfen konzeptionell nicht verloren gehen: Typen suchen/erstellen, Kataloge öffnen, einzelne Typen oder ein Vokabular hinzufügen, eigene Typ-Properties und Beziehungsregeln bearbeiten. Gemeinsame Knoten-Properties gelten für alle zugehörigen Annotationstypen; typbezogene Properties nur für den jeweiligen Typ.

Falls du einen Zugang dafür vorschlägst, mache ihn kontextbezogen und zeige ihn als eigenen Folgezustand. Eröffne dafür nicht wieder ungefragt einen dritten allgemeinen Menüpunkt.

Der TEI-Katalog ist aktuell ein kleines Starterset. Ein umfassender TEI-P5-Import ist geplant, aber nicht vorhanden. Keinen fertigen Vollimport und keinen Texteditor als bestehende Funktion darstellen.

## Interaktionen, die erhalten bleiben müssen

- Schnelle Property-Änderungen speichern direkt. Umfangreichere Änderungen im Dialog haben Speichern/Abbrechen. Nicht für jeden Klick eine zusätzliche Bestätigung verlangen.
- Beim Wechsel und Speichern Fokus, Entwürfe und Scrollposition sinnvoll erhalten. Keine ganze Liste kurz deaktivieren oder grau blinken lassen.
- Löschen zeigt die Folgen vorab und verlangt eine Bestätigung. Undo/Redo existiert für erfolgreiche Modelländerungen.
- Navigation vor/zurück ist etwas anderes als Undo/Redo.
- Escape behandelt die nächste aktive Ebene: Eingabe oder obersten Dialog schließen/abbrechen, außerhalb davon vorbereitete Aktion abbrechen, Werkzeug verlassen oder Auswahl lösen. Ein Tastendruck soll nicht mehrere Ebenen gleichzeitig abräumen.
- Fehlermeldungen bleiben beim passenden Kontext. Keine zufälligen Toasts unten rechts.
- Statusmeldungen stehen im Haupteditor oben mittig und verschwinden nach einer Zeit. Actions stehen unten mittig, haben Bedienelemente und keinen Timeout. Hints erklären ein aktives Werkzeug und haben keine Bedienelemente. Diese Systeme nicht vermischen.

## Unser visueller Stil

Nori soll ruhig, flüssig und leicht futuristisch wirken. Keine Neon- oder Sci-Fi-Deko.

- Bestehende Sushi-UI-Komponenten, Tokens und Lucide-Icons verwenden, soweit im Mockup-Werkzeug verfügbar. Sonst deren Darstellung möglichst genau nachbilden.
- Helles und dunkles Theme mit denselben Hierarchien. Dezente Flächen, dünne Ränder, bestehende Rundungen. Keine zusätzlichen Schatten oder dekorativen Verläufe.
- Primary gezielt für aktive Zustände und wichtige Aktionen einsetzen. Keine beliebige neue Farbpalette.
- Wiederkehrende Aktionen als kompakte runde Icon-Buttons. Icons müssen unterscheiden lassen, was eine Aktion und was nur eine Information ist.
- Panelüberschriften überall wie im Haupteditor: Icon und Titel vertikal zentriert, gleiche Größe, Stärke und Einrückung.
- Feste Typografieskala: `text-xl` für Knotentitel, `text-base` für Panelüberschriften und normale Formulartexte, `text-sm` für Labels und Lesetext, `text-xs` für sekundäre Angaben. Keine frei erfundenen px-/pt-Zwischenwerte.
- Außenabstände entsprechen den Panels im Haupteditor. Gleichartige Elemente sind bündig. Sinnvolle Einrückungen innerhalb von Gruppen bleiben erhalten.
- Mehr Platz vorsehen, wo er Orientierung schafft. Nicht alles in eine Zeile quetschen; aber auch nicht jede kleine Information in eine zusätzliche Karte verpacken.
- Beschreibungen sind optional, maximal 2.000 Zeichen und sekundär. Keine dauerhafte große Textarea und kein „+ Add description“ als Standardansicht.
- Normale Dialoge bleiben in der bestehenden Formularbreite, sind nicht draggable und haben Aktionen unten rechts: Abbrechen, danach die konkrete Hauptaktion.
- Bestätigungen heben Namen mit Fettdruck statt Anführungszeichen hervor.
- Animationen zurückhaltend, zusammenhängend und im bestehenden App-Stil. Keine unabhängig fliegenden Inhalte, kein Springen, keine neuen Federanimationen.

Verwende für die Mockups englische UI-Texte wie in den Referenzbildern. Kurze Titel ohne abschließenden Punkt; vollständige Erklärungssätze mit Punkt. Kein generischer Fülltext.

## Was ich als Ergebnis brauche

Zeige zuerst zwei konkrete, vergleichbare Desktop-Varianten mit denselben Beispieldaten. Eine soll nah am aktuellen Versuch mit Knotenkontext und Graph links und einer kompakten Leiste über der Bearbeitungsfläche bleiben. Die zweite darf deren Gruppierung und die Platzierung der Detailansicht anders lösen, muss aber klar als Nori erkennbar bleiben.

Arbeite für die stärkere Variante diese Zustände aus:

1. Knoten ausgewählt, Properties geöffnet: geerbte Properties, mehrere eigene Properties und die leere neue Zeile.
2. Property-Details geöffnet: einfacher Bearbeitungsdialog mit Beschreibung und Regeln.
3. Beziehung ausgewählt: Quelle, Ziel und Regeln sichtbar, ohne den Knoten-Kontext zu verlieren.
4. Constraints geöffnet: Herkunft und Geltungsbereich verständlich.

Nutze beispielsweise **Letter**, verfeinert **Collection**, mit eigenen Properties **title** und **date** sowie einer Beziehung zu **Text**. Kennzeichne das als Mockup-Beispieldaten, nicht als aus dem Projekt übernommene Definitionen.

Zeige außerdem kurz, wie lange Namen, viele Einträge und ein schmaleres Fenster behandelt werden. Eine kontextbezogene Annotationsansicht kann als separater Folgeschritt hinzukommen.

Beschreibe pro Variante knapp, was ausgewählt ist, was ein Klick öffnet, was direkt speichert und wie man zurückkommt. Unterscheide bestehende Funktionen von vorgeschlagenen Erweiterungen. Ich will die Interaktion beurteilen können, nicht nur eine hübsche statische Fläche.
