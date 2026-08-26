<?php

class Response {

    public static function json(array $data, int $code = 200): void {
        http_response_code($code);
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode($data, JSON_UNESCAPED_UNICODE);
        exit;
    }

    public static function success($data = null, string $message = 'OK'): void {
        self::json(['success' => true, 'message' => $message, 'data' => $data]);
    }

    public static function error(string $message, int $code = 400, array $extra = []): void {
        self::json(array_merge(['success' => false, 'error' => $message], $extra), $code);
    }

    public static function notFound(string $message = 'Not found'): void {
        self::error($message, 404);
    }

    public static function forbidden(string $message = 'Access denied'): void {
        self::error($message, 403);
    }

    public static function unauthorized(): void {
        self::error('Unauthorised. Please log in.', 401);
    }

    public static function paginated(array $rows, int $total, int $page, int $perPage): void {
        self::json([
            'success'      => true,
            'data'         => $rows,
            'total'        => $total,
            'page'         => $page,
            'per_page'     => $perPage,
            'total_pages'  => (int)ceil($total / $perPage),
        ]);
    }
}
