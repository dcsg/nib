# nib.config.json

Optional project configuration file that controls navigation, templates, and device frames for your prototypes.

## Schema

```json
{
  "title": "My Prototype",
  "template": "clean",
  "device": "iPhone 16 Pro",
  "links": [
    {
      "from": "Home",
      "nodeId": "abc123",
      "to": "Settings",
      "transition": "slide-left"
    }
  ]
}
```

## Top-Level Fields

| Field | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `title` | `string` | No | | Custom title for the prototype |
| `template` | `string` | No | `"clean"` | Default template: `"clean"` or `"presentation"` |
| `device` | `string` | No | | Default device frame name (see `nib devices`) |
| `links` | `NibLink[]` | No | `[]` | Navigation links between canvases via hotspots |

## NibLink Object

Each entry in the `links` array defines a clickable hotspot that navigates between canvases.

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `from` | `string` | Yes | Source canvas name |
| `nodeId` | `string` | Yes | Node ID within the source canvas that acts as the hotspot |
| `to` | `string` | Yes | Target canvas name |
| `transition` | `string` | No | Transition type: `"slide-left"`, `"slide-right"`, `"fade"`, `"none"` |

::: details Full Multi-Link Example

```json
{
  "title": "Mobile App Prototype",
  "template": "presentation",
  "device": "iPhone 16 Pro",
  "links": [
    {
      "from": "Splash",
      "nodeId": "splash-cta",
      "to": "Home",
      "transition": "fade"
    },
    {
      "from": "Home",
      "nodeId": "nav-settings",
      "to": "Settings",
      "transition": "slide-left"
    },
    {
      "from": "Settings",
      "nodeId": "back-btn",
      "to": "Home",
      "transition": "slide-right"
    },
    {
      "from": "Home",
      "nodeId": "nav-profile",
      "to": "Profile",
      "transition": "slide-left"
    },
    {
      "from": "Profile",
      "nodeId": "back-btn",
      "to": "Home",
      "transition": "slide-right"
    }
  ]
}
```

:::
