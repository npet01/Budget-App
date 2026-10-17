# Was kostet mich das wirklich?

Eine Web-App, die Preise in deine echte Arbeitszeit umrechnet und zeigt, ab wann du dir einen Wunsch leisten kannst, ohne Schulden zu machen.

- **Echter Stundenlohn:** Nettogehalt geteilt durch Arbeitszeit plus Fahrtzeit.
- **Wunschliste:** Jeder Wunsch zeigt Stunden und Arbeitstage und das Datum, ab dem er leistbar ist. Wünsche werden in Listenreihenfolge angespart.
- **48 Stunden Bedenkzeit:** Wünsche lassen sich parken, bevor man sie kauft.
- **Ausgaben und Kassenbons:** Bon fotografieren, die Summe wird auf dem Gerät erkannt. Ausgaben über dem Alltagsbudget verschieben die Wünsche, und die App sagt, um wie viele Tage.
- **Teilen aus Shop-Apps:** Als installierte App auf Android erscheint sie im Teilen-Menü; Name und Link landen direkt im Wunsch-Formular.

Alle Daten bleiben im Browser des Geräts (localStorage). Es gibt keinen Server, kein Konto und kein Tracking. Die Texterkennung für Bons läuft mit [Tesseract.js](https://github.com/naptha/tesseract.js) im Browser; beim ersten Scan lädt sie einmalig die deutschen Sprachdaten nach.

## Entwickeln

```bash
npm install
npm run dev      # Entwicklungsserver
npm test         # Tests für Rechnung und Bon-Erkennung
npm run build    # Produktions-Build nach dist/
```

## Veröffentlichen

Der Workflow in `.github/workflows/deploy.yml` baut die App bei jedem Push auf `main` und veröffentlicht sie über GitHub Pages. Dafür in den Repository-Einstellungen unter **Settings → Pages → Source** einmal **GitHub Actions** auswählen.

Auf dem Handy die Seite öffnen und „Zum Home-Bildschirm hinzufügen“ wählen; dann verhält sie sich wie eine App.

## So rechnet die App

- Überschuss pro Monat = Netto − Fixkosten − Alltagsbudget − Sicherheitspuffer.
- Heute verfügbar = Erspartes am Stichtag + seitdem tageweise angefallener Überschuss − gekaufte Wünsche − Alltagsausgaben, die pro Monat über dem Budget liegen.
- Weniger ausgegeben als geplant zählt nicht als Plus, damit die Rechnung auf der sicheren Seite bleibt.

## Nächste Schritte

- Preis automatisch von der Produktseite lesen (braucht einen kleinen Server, weil Browser fremde Seiten nicht direkt abrufen dürfen)
- Erinnerung, wenn ein Wunsch leistbar wird oder die Bedenkzeit endet
- Bon-Fotos als Garantiebeleg speichern
- Echte Apps für iPhone und Android mit Capacitor aus demselben Code
