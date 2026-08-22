# Code variant

This is the smallest readable form of **Quant as Anything**.

It is intentionally standard-library only and deliberately explicit about its limits. The point of this variant is to make Quant's shape inspectable:

```text
read → differentiate → weigh → synthesise → refine → speak
```

## Run in the terminal

```bash
python3 quant.py
```

## Serve the design surface

From the repository root:

```bash
python3 code/quant.py --serve
```

Then open:

```text
http://127.0.0.1:8765/design/
```

## Public API

```http
GET  /status
POST /chat
```

`POST /chat` accepts:

```json
{"message":"What are we looking at?"}
```

and returns only clean public prose plus a small state envelope:

```json
{"reply":"…","state":"being","model":"Quant"}
```

The reference code does not call a remote model provider.
