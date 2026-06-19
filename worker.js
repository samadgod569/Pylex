export default {
  async fetch(request, env) {
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders,
      });
    }

    const url = new URL(request.url);
    const path = url.pathname;

    function json(data, status = 200) {
      return new Response(
        JSON.stringify(data, null, 2),
        {
          status,
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders,
          },
        }
      );
    }

    async function validateSecret(secret) {
      const key1 = await env.Cloudra.get("cloudra-key-1");
      const key2 = await env.Cloudra.get("cloudra-key-2");
      const key3 = await env.Cloudra.get("cloudra-key-3");

      if (!key1 && !key2 && !key3) {
        return {
          valid: false,
          response: json(
            {
              error:
                "Security keys not configured",
            },
            500
          ),
        };
      }

      const valid =
        secret === key1 ||
        secret === key2 ||
        secret === key3;

      if (!valid) {
        return {
          valid: false,
          response: json(
            {
              error: "Invalid secret key",
            },
            403
          ),
        };
      }

      return {
        valid: true,
      };
    }

    if (
      path === "/api/backups/op" &&
      request.method === "POST"
    ) {
      let body;

      try {
        body = await request.json();
      } catch {
        return json(
          {
            error: "Invalid JSON",
          },
          400
        );
      }

      const {
        secret,
        backupData,
        backupId,
        operation,
      } = body;

      if (!secret || !operation) {
        return json(
          {
            error:
              "Missing secret or operation",
          },
          400
        );
      }

      const auth =
        await validateSecret(secret);

      if (!auth.valid) {
        return auth.response;
      }

      if (!backupId) {
        return json(
          {
            error: "Missing backupId",
          },
          400
        );
      }

      const kvKey = `cloudra/backups/${backupId}`;

      if (operation === "GET") {
        const value =
          await env.Cloudra.get(kvKey, {
            type: "json",
          });

        if (!value) {
          return json(
            {
              error: "Backup not found",
            },
            404
          );
        }

        return json({
          success: true,
          backupId,
          data: value,
        });
      }

      if (operation === "CREATE") {
        if (
          backupData === undefined
        ) {
          return json(
            {
              error:
                "Missing backupData for CREATE",
            },
            400
          );
        }

        await env.Cloudra.put(
          kvKey,
          JSON.stringify(backupData)
        );

        return json({
          success: true,
          message:
            "Backup created successfully",
          backupId,
          data: backupData,
        });
      }

      if (operation === "DELETE") {
        await env.Cloudra.delete(kvKey);

        return json({
          success: true,
          message:
            "Backup deleted successfully",
          backupId,
        });
      }

      return json(
        {
          error: "Invalid operation",
        },
        400
      );
    }

    if (
      path === "/api/img" &&
      request.method === "POST"
    ) {
      let body;

      try {
        body = await request.json();
      } catch {
        return json(
          {
            error: "Invalid JSON",
          },
          400
        );
      }

      const {
        secret,
        appName,
        img,
        type,
      } = body;

      if (
        !secret ||
        !appName ||
        !img ||
        !type
      ) {
        return json(
          {
            error:
              "Missing secret, appName, img or type",
          },
          400
        );
      }

      const auth =
        await validateSecret(secret);

      if (!auth.valid) {
        return auth.response;
      }

      if (
        type !== "CREATE" &&
        type !== "UPDATE"
      ) {
        return json(
          {
            error: "Invalid type",
          },
          400
        );
      }

      try {
        const base64 = img.includes(",")
          ? img.split(",")[1]
          : img;

        const binary = atob(base64);

        const bytes = new Uint8Array(
          binary.length
        );

        for (
          let i = 0;
          i < binary.length;
          i++
        ) {
          bytes[i] =
            binary.charCodeAt(i);
        }

        await env.Cloudra.put(
          `cloudra/img/${appName}`,
          bytes.buffer
        );

        return json({
          success: true,
          message:
            type === "CREATE"
              ? "Image created successfully"
              : "Image updated successfully",
          appName,
        });
      } catch (err) {
        return json(
          {
            error:
              "Failed to process image",
            details: String(err),
          },
          500
        );
      }
    }
    if (
  path.startsWith("/img/") &&
  request.method === "GET"
) {
  const appName =
    decodeURIComponent(
      path.replace("/img/", "")
    );

  const image =
    await env.Cloudra.get(
      `cloudra/img/${appName}`,
      "arrayBuffer"
    );

  if (!image) {
    return new Response(
      "Image not found",
      { status: 404 }
    );
  }

  return new Response(image, {
    headers: {
      ...corsHeaders,
      "Content-Type":
        "image/png",
    },
  });
    }

    return json(
      {
        error: "Route not found",
      },
      404
    );
  },
};
