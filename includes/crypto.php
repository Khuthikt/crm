<?php
class Crypto {
    private static function key(): string {
        $keyFile = __DIR__ . '/.encryption_key';
        if (!file_exists($keyFile)) {
            $key = bin2hex(random_bytes(32));
            file_put_contents($keyFile, $key);
            chmod($keyFile, 0600);
        }
        return hex2bin(trim(file_get_contents($keyFile)));
    }

    public static function encrypt(string $value): string {
        $iv  = random_bytes(16);
        $enc = openssl_encrypt($value, 'AES-256-CBC', self::key(), OPENSSL_RAW_DATA, $iv);
        return base64_encode($iv . $enc);
    }

    public static function decrypt(string $value): string {
        $raw = base64_decode($value);
        $iv  = substr($raw, 0, 16);
        $enc = substr($raw, 16);
        return openssl_decrypt($enc, 'AES-256-CBC', self::key(), OPENSSL_RAW_DATA, $iv);
    }
}
