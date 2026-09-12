<?php
namespace OWMC\Core;

/**
 * Minimal PSR-11-inspired service container.
 * Supports singleton bindings and factory closures.
 */
class Container {

    /** @var array<string, callable> */
    private array $bindings = [];

    /** @var array<string, mixed> */
    private array $singletons = [];

    /** @var array<string, bool> */
    private array $singleton_flags = [];

    public function bind( string $abstract, callable $factory ): void {
        $this->bindings[ $abstract ] = $factory;
    }

    public function singleton( string $abstract, callable $factory ): void {
        $this->bindings[ $abstract ]       = $factory;
        $this->singleton_flags[ $abstract ] = true;
    }

    public function make( string $abstract ): mixed {
        if ( isset( $this->singleton_flags[ $abstract ] ) ) {
            if ( ! isset( $this->singletons[ $abstract ] ) ) {
                $this->singletons[ $abstract ] = ( $this->bindings[ $abstract ] )( $this );
            }
            return $this->singletons[ $abstract ];
        }

        if ( isset( $this->bindings[ $abstract ] ) ) {
            return ( $this->bindings[ $abstract ] )( $this );
        }

        throw new \RuntimeException( "OWMC Container: No binding for [{$abstract}]." );
    }

    public function has( string $abstract ): bool {
        return isset( $this->bindings[ $abstract ] );
    }
}
